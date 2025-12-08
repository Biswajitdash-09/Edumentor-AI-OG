import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DemoVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DemoVideoDialog = ({ open, onOpenChange }: DemoVideoDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>EduMentor AI Demo</DialogTitle>
        </DialogHeader>
        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
          <div className="text-center p-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-primary"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Demo Video Coming Soon
            </h3>
            <p className="text-muted-foreground text-sm max-w-md">
              We're preparing an interactive walkthrough of EduMentor AI's features. 
              Check back soon to see how our platform can transform your educational experience.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DemoVideoDialog;
