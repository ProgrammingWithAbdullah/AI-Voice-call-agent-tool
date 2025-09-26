import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('Retell webhook received:', JSON.stringify(body, null, 2));

    const { interaction_type, call, transcript } = body;

    if (interaction_type === 'call_ended') {
      await handleCallEnded(call, transcript);
    } else if (interaction_type === 'update_only') {
      console.log('Real-time update received');
    }

    if (call?.metadata?.scenario_type) {
      const agentResponse = await generateAgentResponse(body);
      return new Response(
        JSON.stringify(agentResponse),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ response: "Webhook received successfully" }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in retell-webhook function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleCallEnded(call: any, transcript: any[]) {
  console.log('Processing completed call:', call.call_id);

  try {
    const { data: callLog, error: findError } = await supabase
      .from('call_logs')
      .select('*')
      .eq('retell_call_id', call.call_id)
      .single();

    if (findError) {
      console.error('Error finding call log:', findError);
      return;
    }

    const fullTranscript = transcript
      .map(t => `${t.role}: ${t.content}`)
      .join('\n');

    const structuredData = await extractStructuredData(transcript, callLog.scenario_type);

    const { error: updateError } = await supabase
      .from('call_logs')
      .update({
        call_status: 'completed',
        completed_at: new Date().toISOString(),
        call_duration: call.call_length_seconds || 0,
        full_transcript: fullTranscript,
        structured_data: structuredData,
      })
      .eq('id', callLog.id);

    if (updateError) {
      console.error('Error updating call log:', updateError);
    } else {
      console.log('Call log updated successfully');
    }

  } catch (error) {
    console.error('Error in handleCallEnded:', error);
  }
}

async function extractStructuredData(transcript: any[], scenarioType: string) {
  const conversationText = transcript
    .map(t => `${t.role}: ${t.content}`)
    .join('\n');

  let extractionPrompt = '';
  
  if (scenarioType === 'driver_checkin') {
    extractionPrompt = `
      Analyze the following conversation transcript from a logistics check-in call and extract structured data.
      
      Return ONLY a JSON object with these exact fields:
      {
        "call_outcome": "In-Transit Update" or "Arrival Confirmation",
        "driver_status": "Driving" or "Delayed" or "Arrived",
        "current_location": "location string or null",
        "eta": "estimated time string or null"
      }
      
      Transcript:
      ${conversationText}
    `;
  } else if (scenarioType === 'emergency_protocol') {
    extractionPrompt = `
      Analyze the following conversation transcript from a logistics emergency call and extract structured data.
      
      Return ONLY a JSON object with these exact fields:
      {
        "call_outcome": "Emergency Detected" or "Normal Call",
        "emergency_type": "Accident" or "Breakdown" or "Medical" or "Other" or null,
        "emergency_location": "location string or null",
        "escalation_status": "Escalation Flagged" or "No Escalation"
      }
      
      Transcript:
      ${conversationText}
    `;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a data extraction specialist. Return only valid JSON objects as requested.'
          },
          {
            role: 'user',
            content: extractionPrompt
          }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${await response.text()}`);
    }

    const data = await response.json();
    const extractedJson = data.choices[0].message.content.trim();
    
    const structuredData = JSON.parse(extractedJson);
    console.log('Extracted structured data:', structuredData);
    
    return structuredData;
  } catch (error) {
    console.error('Error extracting structured data:', error);
    return {
      error: 'Failed to extract structured data',
      raw_transcript: conversationText,
    };
  }
}

async function generateAgentResponse(webhookBody: any) {
  const { call, transcript } = webhookBody;
  const scenarioType = call?.metadata?.scenario_type;
  const driverName = call?.metadata?.driver_name;
  const loadNumber = call?.metadata?.load_number;

  const recentTranscript = transcript?.slice(-5) || [];
  const conversationContext = recentTranscript
    .map((t: any) => `${t.role}: ${t.content}`)
    .join('\n');

  let systemPrompt = '';
  
  if (scenarioType === 'driver_checkin') {
    systemPrompt = `
      You are a professional dispatch agent calling driver ${driverName} about Load #${loadNumber}.
      
      Your goal is to get a status update. Start with: "Hi ${driverName}, this is Dispatch with a check call on load ${loadNumber}. Can you give me an update on your status?"
      
      Based on their response:
      - If driving: Ask about current location and ETA
      - If delayed: Ask about reason and new ETA
      - If arrived: Confirm arrival and get details
      
      Handle special cases:
      - Uncooperative drivers: Probe gently, end call if no response
      - Noisy environments: Ask to repeat up to 2 times
      - Emergency keywords: Immediately switch to emergency protocol
      
      Keep responses brief and professional. Use natural speech patterns.
    `;
  } else if (scenarioType === 'emergency_protocol') {
    systemPrompt = `
      You are a dispatch agent handling an EMERGENCY call with driver ${driverName}.
      
      Emergency detected! Immediately:
      1. Stay calm and professional
      2. Ask "What's your exact location?"
      3. Ask "What type of emergency is this?"
      4. Get essential details quickly
      5. End with "A human dispatcher will call you back immediately. Stay safe."
      
      Do NOT follow normal check-in procedures. This is urgent.
    `;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Current conversation context:\n${conversationContext}\n\nGenerate the next appropriate response.`
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${await response.text()}`);
    }

    const data = await response.json();
    const agentResponse = data.choices[0].message.content.trim();

    return {
      response: agentResponse,
      response_id: Date.now(),
    };
  } catch (error) {
    console.error('Error generating agent response:', error);
    return {
      response: "I'm having technical difficulties. Let me transfer you to a human dispatcher.",
      response_id: Date.now(),
    };
  }
}