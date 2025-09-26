# AI Voice Agent Tool for Logistics

A comprehensive web application that enables non-technical administrators to configure, test, and review calls made by adaptive AI voice agents for logistics operations.

## 🚀 Features

- **Agent Configuration UI**: Create and manage AI voice agent configurations with custom prompts and logic
- **Call Triggering**: Initiate test calls with driver information and load numbers
- **Call Analysis**: Review structured data extraction and full transcripts from completed calls
- **Two Logistics Scenarios**:
  - **Driver Check-in**: Status updates for loads in transit
  - **Emergency Protocol**: Handle emergency situations with immediate escalation

## 🏗 Architecture

### Frontend (React + TypeScript)
- **Dashboard**: Single-page application with tabbed interface
- **Agent Configuration**: Dynamic prompt editor with scenario selection
- **Call Management**: Real-time call triggering and status monitoring
- **Results Analysis**: Structured data display with transcript review

### Backend (Supabase Edge Functions)
- **trigger-call**: Initiates Retell AI phone calls with dynamic prompts
- **retell-webhook**: Handles real-time conversation and call logic and post-call processing
- **Database**: Supabase for agent configurations and call logs

### AI Integration
- **Retell AI**: Voice calling platform with human-like conversation
- **OpenAI GPT-4**: Conversation logic and structured data extraction
- **Dynamic Prompting**: Context-aware agent behavior based on scenarios

## 📊 Database Schema

### agent_configurations
- `id`, `name`, `system_prompt`, `scenario_type`, `retell_settings`
- Stores reusable agent configurations with optimized voice settings

### call_logs  
- `id`, `driver_name`, `driver_phone`, `load_number`, `call_status`
- `full_transcript`, `structured_data`, `call_duration`
- Complete call history with extracted insights

## 🎯 Logistics Scenarios

### Scenario 1: Driver Check-in
**Context**: Routine status update calls to drivers about specific loads
**Goal**: Gather current status, location, and ETA information
**Structured Data Extracted**:
- `call_outcome`: "In-Transit Update" or "Arrival Confirmation"
- `driver_status`: "Driving", "Delayed", or "Arrived"
- `current_location`: Geographic location string
- `eta`: Estimated time of arrival

### Scenario 2: Emergency Protocol
**Context**: Emergency situations during routine calls (breakdowns, accidents)
**Goal**: Immediately gather critical information and escalate to human dispatcher
**Structured Data Extracted**:
- `call_outcome`: "Emergency Detected"
- `emergency_type`: "Accident", "Breakdown", "Medical", or "Other"
- `emergency_location`: Precise location of emergency
- `escalation_status`: "Escalation Flagged"

## 🔧 Advanced Features

### Dynamic Response Handling
- **Uncooperative Drivers**: Intelligent probing with graceful call termination
- **Noisy Environments**: Automatic retry logic with speech clarification
- **Emergency Detection**: Keyword-triggered protocol switching

### Voice Optimization (Retell AI Settings)
- **Backchanneling**: Natural "mm-hmm" responses during driver speech
- **Filler Words**: Human-like hesitations and natural speech patterns  
- **Interruption Sensitivity**: Balanced conversation flow management
- **Response Delay**: Optimized timing for natural conversation rhythm

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project
- Retell AI account with phone number
- OpenAI API key

### Environment Setup
The application requires these API keys (configured via Supabase secrets):
- `VITE_SUPABASE_PROJECT_ID`: Supabase project ID
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key
- `VITE_SUPABASE_URL`: Supabase project URL (frontend use)
- `SUPABASE_URL`: Supabase project URL (same as above URL but for backend use)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (server-side)
- `RETELL_API_KEY`: Retell AI platform access
- `RETELL_AGENT_ID`: Your Retell AI agent ID

### Installation
```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Start development server
npm run dev
```

### Supabase Setup
The application uses Supabase for:
- Database (agent configurations and call logs)
- Edge Functions (call triggering and webhook handling)
- Secrets management (API keys)

## 💼 Design Choices

### Technology Stack Rationale
- **React + TypeScript**: Type-safe frontend development with excellent component reusability
- **Supabase**: Integrated backend-as-a-service with built-in real-time capabilities
- **Retell AI**: Specialized voice AI platform with superior conversation quality
- **OpenAI GPT-4**: Advanced natural language understanding for dynamic responses

### Architecture Decisions
- **Single Page Application**: Single page easy to use administrator workflow
- **Edge Functions**: Serverless architecture for webhook handling
- **Structured Data Extraction**: Post-call processing for actionable insights
- **Configuration-Driven**: Reusable agent templates for different scenarios

### Voice Quality Optimization
- **Human-like Settings**: Carefully tuned Retell AI parameters for natural conversations
- **Context Injection**: Dynamic prompt modification based on call context
- **Error Recovery**: Robust handling of speech recognition failures
- **Emergency Protocols**: Immediate conversation flow switching for urgent situations

## 🎬 Demo Workflow

1. **Configure Agent**: Create a "Driver Check-in" configuration with custom prompts
2. **Trigger Call**: Enter driver details (Name: "Abdullah Amer", Phone: "+923004934903", Load: "7891-B")
3. **Monitor Progress**: Watch real-time call status updates
4. **Review Results**: Analyze extracted structured data and full transcript

---
