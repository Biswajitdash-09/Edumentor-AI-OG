import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Download, FileText, Image, File } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DocumentPreviewProps {
  filePath: string;
  fileName: string;
  bucketName: string;
}

const DocumentPreview = ({ filePath, fileName, bucketName }: DocumentPreviewProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getFileExtension = (name: string) => {
    return name.split(".").pop()?.toLowerCase() || "";
  };

  const isPreviewable = (name: string) => {
    const ext = getFileExtension(name);
    return ["pdf", "png", "jpg", "jpeg", "gif", "webp", "txt"].includes(ext);
  };

  const isPdf = (name: string) => getFileExtension(name) === "pdf";
  const isImage = (name: string) => ["png", "jpg", "jpeg", "gif", "webp"].includes(getFileExtension(name));
  const isText = (name: string) => getFileExtension(name) === "txt";

  const handlePreview = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;

      setPreviewUrl(data.signedUrl);
      setIsOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load preview",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(filePath);

      if (error || !data) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive"
      });
    }
  };

  const getFileIcon = () => {
    if (isPdf(fileName)) return <FileText className="w-4 h-4" />;
    if (isImage(fileName)) return <Image className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {isPreviewable(fileName) && (
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={loading}>
            <Eye className="w-4 h-4 mr-1" />
            {loading ? "Loading..." : "Preview"}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="w-4 h-4 mr-1" />
          Download
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getFileIcon()}
              {fileName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewUrl && isPdf(fileName) && (
              <iframe
                src={`${previewUrl}#toolbar=1`}
                className="w-full h-[70vh] border rounded"
                title={fileName}
              />
            )}
            {previewUrl && isImage(fileName) && (
              <div className="flex items-center justify-center p-4">
                <img
                  src={previewUrl}
                  alt={fileName}
                  className="max-w-full max-h-[70vh] object-contain rounded"
                />
              </div>
            )}
            {previewUrl && isText(fileName) && (
              <iframe
                src={previewUrl}
                className="w-full h-[70vh] border rounded bg-muted"
                title={fileName}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DocumentPreview;
