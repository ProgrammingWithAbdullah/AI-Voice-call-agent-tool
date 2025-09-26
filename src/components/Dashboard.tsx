import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Settings, History, Play, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AgentConfig {
  id: string;
  name: string;
  system_prompt: string;
  scenario_type: string;
  retell_settings: any;
}

interface CallLog {
  id: string;
  driver_name: string;
  driver_phone: string;
  load_number: string;
  call_status: string;
  started_at: string;
  completed_at: string;
  full_transcript: string;
  structured_data: any;
  call_duration: number;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('configure');
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Agent configuration form
  const [configForm, setConfigForm] = useState({
    name: '',
    system_prompt: '',
    scenario_type: 'driver_checkin' as 'driver_checkin' | 'emergency_protocol',
  });

  // Call trigger form
  const [callForm, setCallForm] = useState({
    driver_name: '',
    driver_phone: '',
    load_number: '',
  });

  useEffect(() => {
    loadAgentConfigurations();
    loadCallHistory();
  }, []);

  const loadAgentConfigurations = async () => {
    const { data, error } = await supabase
      .from('agent_configurations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading configurations:', error);
      return;
    }

    setAgentConfigs(data || []);
    if (data && data.length > 0 && !selectedConfig) {
      setSelectedConfig(data[0].id);
    }
  };

  const loadCallHistory = async () => {
    const { data, error } = await supabase
      .from('call_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error loading call history:', error);
      return;
    }

    setCallLogs(data || []);
  };

  const saveAgentConfiguration = async () => {
    if (!configForm.name || !configForm.system_prompt) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('agent_configurations')
      .insert([{
        name: configForm.name,
        system_prompt: configForm.system_prompt,
        scenario_type: configForm.scenario_type,
        retell_settings: {
          backchanneling_enabled: true,
          filler_words_enabled: true,
          interruption_sensitivity: 0.7,
          response_delay_ms: 300,
        },
      }])
      .select()
      .single();

    setIsLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'Agent configuration saved successfully.',
    });

    setConfigForm({ name: '', system_prompt: '', scenario_type: 'driver_checkin' });
    loadAgentConfigurations();
  };

  const triggerCall = async () => {
    if (!callForm.driver_name || !callForm.driver_phone || !callForm.load_number || !selectedConfig) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields and select an agent configuration.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke('trigger-call', {
        body: {
          agent_config_id: selectedConfig,
          driver_name: callForm.driver_name,
          driver_phone: callForm.driver_phone,
          load_number: callForm.load_number,
        },
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: 'Call Initiated',
        description: `Starting call to ${callForm.driver_name} about Load #${callForm.load_number}`,
      });

      setCallForm({ driver_name: '', driver_phone: '', load_number: '' });
      setTimeout(loadCallHistory, 2000); // Refresh call history after a delay
    } catch (error) {
      console.error('Error triggering call:', error);
      toast({
        title: 'Error',
        description: 'Failed to initiate call. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-warning text-warning-foreground"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            AI Voice Agent Dashboard
          </h1>
          <p className="text-muted-foreground text-lg">
            Configure, test, and monitor logistics voice agents
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-card shadow-card">
            <TabsTrigger value="configure" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configure Agent
            </TabsTrigger>
            <TabsTrigger value="call" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Test Call
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Call History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="configure" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Create Agent Configuration
                  </CardTitle>
                  <CardDescription>
                    Define the prompts and logic that guide your agent's conversations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="config-name">Configuration Name</Label>
                    <Input
                      id="config-name"
                      placeholder="Any name to identify this configuration"
                      value={configForm.name}
                      onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="scenario-type">Scenario Type</Label>
                    <Select
                      value={configForm.scenario_type}
                      onValueChange={(value) =>
                        setConfigForm({ ...configForm, scenario_type: value as 'driver_checkin' | 'emergency_protocol' })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="driver_checkin">Driver Check-in</SelectItem>
                        <SelectItem value="emergency_protocol">Emergency Protocol</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="system-prompt">System Prompt</Label>
                    <Textarea
                      id="system-prompt"
                      placeholder="Define the agent's behavior, conversation flow, and objectives e.t.c"
                      className="min-h-[200px]"
                      value={configForm.system_prompt}
                      onChange={(e) => setConfigForm({ ...configForm, system_prompt: e.target.value })}
                    />
                  </div>

                  <Button
                    onClick={saveAgentConfiguration}
                    disabled={isLoading}
                    className="w-full bg-gradient-primary hover:bg-primary-glow"
                  >
                    {isLoading ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Existing Configurations</CardTitle>
                  <CardDescription>
                    Manage your saved agent configurations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {agentConfigs.map((config) => (
                      <div
                        key={config.id}
                        className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{config.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {config.scenario_type.replace('_', ' ').toUpperCase()}
                            </p>
                          </div>
                          <Badge variant="outline">
                            {config.scenario_type === 'driver_checkin' ? 'Check-in' : 'Emergency'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {agentConfigs.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        No configurations yet. Create your first one!
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="call" className="space-y-6">
            <Card className="shadow-card max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-accent" />
                  Trigger Test Call
                </CardTitle>
                <CardDescription>
                  Start a voice call with the configured AI agent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agent-select">Select Agent Configuration</Label>
                  <Select value={selectedConfig} onValueChange={setSelectedConfig}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an agent configuration" />
                    </SelectTrigger>
                    <SelectContent>
                      {agentConfigs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="driver-name">Driver Name</Label>
                    <Input
                      id="driver-name"
                      placeholder="Name of the driver"
                      value={callForm.driver_name}
                      onChange={(e) => setCallForm({ ...callForm, driver_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver-phone">Driver Phone</Label>
                    <Input
                      id="driver-phone"
                      placeholder="driver's phone number"
                      value={callForm.driver_phone}
                      onChange={(e) => setCallForm({ ...callForm, driver_phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="load-number">Load Number</Label>
                  <Input
                    id="load-number"
                    placeholder="e.g.: 789-B"
                    value={callForm.load_number}
                    onChange={(e) => setCallForm({ ...callForm, load_number: e.target.value })}
                  />
                </div>

                <Button
                  onClick={triggerCall}
                  disabled={isLoading || !selectedConfig}
                  className="w-full bg-gradient-accent hover:bg-accent text-accent-foreground"
                  size="lg"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isLoading ? 'Initiating Call...' : 'Start Test Call'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Call History
                </CardTitle>
                <CardDescription>
                  Review past calls and their structured results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {callLogs.map((call) => (
                    <div key={call.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">
                            {call.driver_name} - Load #{call.load_number}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(call.started_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(call.call_status)}
                          <Badge variant="outline">{formatDuration(call.call_duration)}</Badge>
                        </div>
                      </div>

                      {call.structured_data && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <h5 className="font-medium mb-2">Structured Data:</h5>
                          <pre className="text-sm whitespace-pre-wrap">
                            {JSON.stringify(call.structured_data, null, 2)}
                          </pre>
                        </div>
                      )}

                      {call.full_transcript && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <h5 className="font-medium mb-2">Full Transcript:</h5>
                          <p className="text-sm whitespace-pre-wrap">{call.full_transcript}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {callLogs.length === 0 && (
                    <div className="text-center py-8">
                      <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No calls yet. Start your first test call!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}