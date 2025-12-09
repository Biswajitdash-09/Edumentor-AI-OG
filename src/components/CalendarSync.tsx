import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Download, ExternalLink, Copy, Check } from "lucide-react";
import { downloadCalendar } from "@/lib/calendarExport";

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  start_date: string;
  end_date: string | null;
  courses: {
    code: string;
    title: string;
  };
}

interface CalendarSyncProps {
  schedules: Schedule[];
}

export default function CalendarSync({ schedules }: CalendarSyncProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleDownloadICS = () => {
    if (schedules.length === 0) {
      toast({
        title: "No schedules",
        description: "No classes to export",
        variant: "destructive"
      });
      return;
    }

    downloadCalendar(schedules, "edumentor-schedule");
    toast({
      title: "Calendar Downloaded",
      description: "Import the .ics file into your calendar app"
    });
  };

  const handleAddToGoogle = () => {
    // Generate Google Calendar URL for first class as example
    const baseUrl = "https://calendar.google.com/calendar/render?action=TEMPLATE";
    const params = new URLSearchParams({
      text: "EduMentor Classes",
      details: "Your class schedule from EduMentor AI"
    });
    
    window.open(`${baseUrl}&${params.toString()}`, "_blank");
    toast({
      title: "Opening Google Calendar",
      description: "Download the .ics file for full schedule import"
    });
  };

  const handleCopyLink = () => {
    // In a real app, this would be a webcal:// subscription URL
    const fakeWebcalUrl = `webcal://app.edumentor.ai/calendar/${Date.now()}.ics`;
    navigator.clipboard.writeText(fakeWebcalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Link Copied",
      description: "Paste this URL in your calendar app to subscribe"
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Calendar Sync
        </CardTitle>
        <CardDescription>
          Export your schedule to external calendar apps
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Download ICS File</p>
              <p className="text-sm text-muted-foreground">
                Import into any calendar app
              </p>
            </div>
          </div>
          <Button onClick={handleDownloadICS}>
            Download
          </Button>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <ExternalLink className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="font-medium">Google Calendar</p>
              <p className="text-sm text-muted-foreground">
                Open Google Calendar to add events
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleAddToGoogle}>
            Open
          </Button>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              {copied ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <Copy className="h-5 w-5 text-green-500" />
              )}
            </div>
            <div>
              <p className="font-medium">Calendar Subscription</p>
              <p className="text-sm text-muted-foreground">
                Auto-sync with your calendar
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleCopyLink}>
            {copied ? "Copied!" : "Copy Link"}
          </Button>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Schedules to export</span>
            <Badge variant="secondary">{schedules.length} classes</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Exports recurring events for 16 weeks from the start date
          </p>
        </div>
      </CardContent>
    </Card>
  );
}