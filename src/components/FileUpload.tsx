import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, Loader2, CheckCircle, File, FileSpreadsheet, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  accept?: string;
  onFileSelect: (file: File | null) => void;
  onFilesSelect?: (files: File[]) => void;
  selectedFile: File | null;
  selectedFiles?: File[];
  existingFileName?: string | null;
  onRemoveExisting?: () => void;
  label?: string;
  description?: string;
  maxSizeMB?: number;
  uploadProgress?: number;
  isUploading?: boolean;
  uploadComplete?: boolean;
  className?: string;
  multiple?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const getFileTypeIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (['pdf'].includes(ext)) {
    return <FileText className="w-5 h-5 text-red-500" />;
  }
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) {
    return <FileText className="w-5 h-5 text-blue-500" />;
  }
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
  }
  if (['ppt', 'pptx', 'odp'].includes(ext)) {
    return <Presentation className="w-5 h-5 text-orange-500" />;
  }
  if (['txt', 'md'].includes(ext)) {
    return <FileText className="w-5 h-5 text-muted-foreground" />;
  }
  return <File className="w-5 h-5 text-muted-foreground" />;
};

export const FileUpload = ({
  accept = ".pdf,.doc,.docx",
  onFileSelect,
  onFilesSelect,
  selectedFile,
  selectedFiles = [],
  existingFileName,
  onRemoveExisting,
  label = "Upload document",
  description = "PDF, DOC, DOCX",
  maxSizeMB = 10,
  uploadProgress = 0,
  isUploading = false,
  uploadComplete = false,
  className,
  multiple = false
}: FileUploadProps) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    setError(null);
    
    // Check file size
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File size must be less than ${maxSizeMB}MB`);
      return false;
    }
    
    return true;
  };

  const handleFile = useCallback((file: File) => {
    if (validateFile(file)) {
      onFileSelect(file);
    }
  }, [onFileSelect, maxSizeMB]);

  const handleFiles = useCallback((files: File[]) => {
    const validFiles = files.filter(file => {
      const maxSize = maxSizeMB * 1024 * 1024;
      return file.size <= maxSize;
    });
    
    if (validFiles.length < files.length) {
      setError(`Some files exceeded ${maxSizeMB}MB limit and were excluded`);
    }
    
    if (onFilesSelect) {
      onFilesSelect(validFiles);
    }
  }, [onFilesSelect, maxSizeMB]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (multiple && onFilesSelect) {
        handleFiles(Array.from(e.dataTransfer.files));
      } else {
        handleFile(e.dataTransfer.files[0]);
      }
    }
  }, [handleFile, handleFiles, multiple, onFilesSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (multiple && onFilesSelect) {
        handleFiles(Array.from(e.target.files));
      } else {
        handleFile(e.target.files[0]);
      }
    }
  };

  const handleRemoveSelected = () => {
    onFileSelect(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleRemoveFromList = (index: number) => {
    if (onFilesSelect) {
      const newFiles = selectedFiles.filter((_, i) => i !== index);
      onFilesSelect(newFiles);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Existing file display */}
      {existingFileName && !selectedFile && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            {getFileTypeIcon(existingFileName)}
            <span className="text-sm font-medium">{existingFileName}</span>
          </div>
          {onRemoveExisting && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemoveExisting}
              className="text-destructive hover:text-destructive h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {/* Selected file display (single) */}
      {selectedFile && !multiple && (
        <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isUploading ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
            ) : uploadComplete ? (
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            ) : (
              getFileTypeIcon(selectedFile.name)
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>
          {!isUploading && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveSelected}
              className="text-muted-foreground hover:text-destructive h-8 w-8 p-0 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {/* Selected files display (multiple) */}
      {multiple && selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isUploading ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                ) : (
                  getFileTypeIcon(file.name)
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              {!isUploading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveFromList(index)}
                  className="text-muted-foreground hover:text-destructive h-8 w-8 p-0 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload progress */}
      {isUploading && uploadProgress > 0 && (
        <div className="space-y-1">
          <Progress value={uploadProgress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            Uploading... {uploadProgress}%
          </p>
        </div>
      )}

      {/* Drop zone */}
      {(!selectedFile || multiple) && (selectedFiles.length === 0 || multiple) && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={handleClick}
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50",
            error && "border-destructive"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleChange}
            className="hidden"
            multiple={multiple}
          />
          <Upload
            className={cn(
              "w-8 h-8 mx-auto mb-2 transition-colors",
              isDragActive ? "text-primary" : "text-muted-foreground"
            )}
          />
          <p className="text-sm font-medium">
            {isDragActive ? "Drop file(s) here" : label}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {description} • Max {maxSizeMB}MB{multiple ? " per file" : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Drag and drop or click to browse
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};
