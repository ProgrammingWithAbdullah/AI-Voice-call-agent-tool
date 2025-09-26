import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const retellApiKey = Deno.env.get('RETELL_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          success: false,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { agent_config_id, driver_name, driver_phone, load_number } = requestBody;

    console.log('Triggering call for:', { agent_config_id, driver_name, driver_phone, load_number });

    const { data: agentConfig, error: configError } = await supabase
      .from('agent_configurations')
      .select('*')
      .eq('id', agent_config_id)
      .single();

    if (configError) {
      throw new Error(`Failed to fetch agent config: ${configError.message}`);
    }

    const { data: callLog, error: logError } = await supabase
      .from('call_logs')
      .insert([{
        agent_config_id,
        driver_name,
        driver_phone,
        load_number,
        call_status: 'initiated',
        started_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (logError) {
      throw new Error(`Failed to create call log: ${logError.message}`);
    }

    console.log('Created call log:', callLog.id);

    let dynamicPrompt = agentConfig.system_prompt;
    
    dynamicPrompt = dynamicPrompt
      .replace(/\{driver_name\}/g, driver_name)
      .replace(/\{load_number\}/g, load_number);

    console.log('Making Retell API request with:', {
      endpoint: 'https://api.retellai.com/v2/create-phone-call',
      agent_id: Deno.env.get('RETELL_AGENT_ID'),
      from_number: '+923004934903',
      to_number: driver_phone,
    });

    const retellPayload = {
      from_number: '+923004934903',
      to_number: driver_phone,
      override_agent_id: Deno.env.get('RETELL_AGENT_ID'),
      metadata: {
        call_log_id: callLog.id.toString(),
        driver_name,
        load_number,
        scenario_type: agentConfig.scenario_type,
      },
      retell_llm_dynamic_variables: {
        driver_name,
        load_number,
      },
    };

    const retellResponse = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${retellApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(retellPayload),
    });

    console.log('Retell API response status:', retellResponse.status);
    console.log('Retell API response headers:', Object.fromEntries(retellResponse.headers.entries()));

    if (!retellResponse.ok) {
      const errorText = await retellResponse.text();
      console.error('Retell API error details:', errorText);
      throw new Error(`Retell API error (${retellResponse.status}): ${errorText}`);
    }

    const retellData = await retellResponse.json();
    console.log('Retell call created:', retellData.call_id);

    await supabase
      .from('call_logs')
      .update({
        retell_call_id: retellData.call_id,
        call_status: 'in_progress',
      })
      .eq('id', callLog.id);

    return new Response(
      JSON.stringify({
        success: true,
        call_id: retellData.call_id,
        call_log_id: callLog.id,
        message: `Call initiated to ${driver_name} about Load #${load_number}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in trigger-call function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});