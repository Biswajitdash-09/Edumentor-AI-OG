import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Play } from "lucide-react";

interface DemoVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DemoVideoDialog = ({ open, onOpenChange }: DemoVideoDialogProps) => {
  // Replace with actual video URL when available
  const hasVideo = false;
  const videoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ"; // Placeholder
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>EduMentor AI Platform Overview</DialogTitle>
        </DialogHeader>
        
        {hasVideo ? (
          <div className="aspect-video">
            <iframe
              className="w-full h-full rounded-lg"
              src={videoUrl}
              title="EduMentor AI Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center p-8">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Play className="w-10 h-10 text-primary ml-1" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Demo Video Coming Soon
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mb-6">
                We're preparing an interactive walkthrough of EduMentor AI's features. 
                In the meantime, sign up to explore the platform yourself!
              </p>
              <Button onClick={() => onOpenChange(false)} className="gap-2">
                <ExternalLink className="w-4 h-4" />
                Explore Platform
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DemoVideoDialog;
