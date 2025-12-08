import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, FileText, ClipboardList, Upload, Download, Calendar, Award, Users, Edit, Trash2, MessageSquare, Search, FolderPlus, Folder, X } from "lucide-react";
import BulkStudentImport from "@/components/BulkStudentImport";
import DocumentPreview from "@/components/DocumentPreview";
import DiscussionForum from "@/components/DiscussionForum";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { EditAssignmentDialog } from "@/components/EditAssignmentDialog";
import { DeleteAssignmentDialog } from "@/components/DeleteAssignmentDialog";
import { ExportDataDialog } from "@/components/ExportDataDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUpload, getFileTypeIcon } from "@/components/FileUpload";

interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
  semester: string;
  year: number;
  faculty_id: string;
  profiles: { full_name: string };
}

interface Material {
  id: string;
  title: string;
  description: string;
  file_path: string;
  file_type?: string;
  folder?: string | null;
  created_at: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  max_points: number;
  file_path?: string | null;
  file_name?: string | null;
  submissions?: { grade: number; submitted_at: string }[];
}

const CourseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [course, setCourse] = useState<Course | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);
  const [deleteAssignment, setDeleteAssignment] = useState<{ id: string; title: string } | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    title: "",
    description: "",
    due_date: "",
    max_points: 100
  });
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [uploadingAssignment, setUploadingAssignment] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialFiles, setMaterialFiles] = useState<File[]>([]);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [materialUploadProgress, setMaterialUploadProgress] = useState(0);
  const [materialSearch, setMaterialSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [uploadFolder, setUploadFolder] = useState<string | null>(null);

  useEffect(() => {
    if (user && id) {
      fetchUserRole();
      fetchCourseDetails();
      fetchMaterials();
      fetchAssignments();
      fetchStudents();
    }
  }, [user, id]);

  const fetchUserRole = async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user?.id)
      .single();
    
    if (data) setUserRole(data.role);
  };

  const fetchCourseDetails = async () => {
    const { data, error } = await supabase
      .from("courses")
      .select("*, profiles:faculty_id (full_name)")
      .eq("id", id)
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load course details",
        variant: "destructive"
      });
      navigate("/courses");
    } else {
      setCourse(data);
    }
    setLoading(false);
  };

  const fetchMaterials = async () => {
    const { data } = await supabase
      .from("course_materials")
      .select("id, title, description, file_path, file_type, folder, created_at")
      .eq("course_id", id)
      .order("folder", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false });

    setMaterials(data || []);
  };

  const fetchAssignments = async () => {
    let query = supabase
      .from("assignments")
      .select("*")
      .eq("course_id", id)
      .order("due_date", { ascending: true });

    // If student, also fetch their submission
    if (userRole === "student") {
      query = query.select(`
        *,
        submissions!left(grade, submitted_at)
      `);
    }

    const { data } = await query;
    setAssignments(data || []);
  };

  const fetchStudents = async () => {
    if (userRole !== "faculty") return;

    const { data } = await supabase
      .from("enrollments")
      .select(`
        id,
        enrolled_at,
        status,
        student_id,
        profiles!enrollments_student_id_fkey(full_name, email, user_id)
      `)
      .eq("course_id", id)
      .eq("status", "active");

    setStudents(data || []);
  };

  const handleCreateAssignment = async () => {
    if (!newAssignment.title || !newAssignment.due_date) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setUploadingAssignment(true);
    
    let filePath = null;
    let fileName = null;
    
    // Upload assignment file if provided
    if (assignmentFile) {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedTypes.includes(assignmentFile.type)) {
        toast({
          title: "Error",
          description: "Only PDF and Word documents are allowed",
          variant: "destructive"
        });
        setUploadingAssignment(false);
        return;
      }

      // Simulate upload progress
      setUploadProgress(10);
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 15, 90));
      }, 200);

      const path = `assignments/${id}/${Date.now()}-${assignmentFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("course-materials")
        .upload(path, assignmentFile);

      clearInterval(progressInterval);

      if (uploadError) {
        setUploadProgress(0);
        toast({
          title: "Error",
          description: "Failed to upload assignment file",
          variant: "destructive"
        });
        setUploadingAssignment(false);
        return;
      }
      
      setUploadProgress(100);
      filePath = path;
      fileName = assignmentFile.name;
    }

    const { data: assignmentData, error } = await supabase
      .from("assignments")
      .insert([{
        ...newAssignment,
        course_id: id,
        file_path: filePath,
        file_name: fileName
      }])
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Assignment created successfully"
      });
      
      // Send notification emails to enrolled students
      if (course && assignmentData) {
        try {
          await supabase.functions.invoke("send-assignment-notification", {
            body: {
              assignmentId: assignmentData.id,
              courseId: id,
              assignmentTitle: newAssignment.title,
              dueDate: newAssignment.due_date,
              courseTitle: course.title,
              courseCode: course.code
            }
          });
          console.log("Assignment notifications sent");
        } catch (notifError) {
          console.error("Failed to send assignment notifications:", notifError);
        }
      }
      
      setIsAssignmentDialogOpen(false);
      setNewAssignment({
        title: "",
        description: "",
        due_date: "",
        max_points: 100
      });
      setAssignmentFile(null);
      setUploadProgress(0);
      fetchAssignments();
    }
    
    setUploadingAssignment(false);
    setUploadProgress(0);
  };

  const handleMaterialUpload = async () => {
    const filesToUpload = materialFiles.length > 0 ? materialFiles : (materialFile ? [materialFile] : []);
    if (filesToUpload.length === 0 || !id) return;

    setUploadingMaterial(true);
    setMaterialUploadProgress(10);
    
    const progressPerFile = 80 / filesToUpload.length;
    let uploadedCount = 0;
    let failedCount = 0;

    for (const file of filesToUpload) {
      const filePath = `${id}/${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from("course-materials")
        .upload(filePath, file);

      if (uploadError) {
        failedCount++;
        continue;
      }

      const { error: dbError } = await supabase
        .from("course_materials")
        .insert([{
          course_id: id,
          title: file.name,
          file_path: filePath,
          file_type: file.type,
          folder: uploadFolder,
          uploaded_by: user?.id
        }]);

      if (!dbError) {
        uploadedCount++;
      } else {
        failedCount++;
      }
      
      setMaterialUploadProgress(10 + (uploadedCount + failedCount) * progressPerFile);
    }

    setMaterialUploadProgress(100);

    if (uploadedCount > 0) {
      toast({
        title: "Success",
        description: `${uploadedCount} material${uploadedCount > 1 ? 's' : ''} uploaded successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`
      });
      fetchMaterials();
    } else {
      toast({
        title: "Error",
        description: "Failed to upload materials",
        variant: "destructive"
      });
    }
    
    setMaterialFile(null);
    setMaterialFiles([]);
    setUploadingMaterial(false);
    setMaterialUploadProgress(0);
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("course-materials")
      .download(filePath);

    if (error || !data) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive"
      });
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  };

  const deleteMaterial = async (materialId: string, filePath: string) => {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("course-materials")
      .remove([filePath]);

    if (storageError) {
      toast({
        title: "Error",
        description: "Failed to delete file from storage",
        variant: "destructive"
      });
      return;
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("course_materials")
      .delete()
      .eq("id", materialId);

    if (dbError) {
      toast({
        title: "Error",
        description: "Failed to delete material record",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Material deleted successfully"
      });
      fetchMaterials();
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading course...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!course) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <Button variant="ghost" onClick={() => navigate("/courses")}>
            ← Back to Courses
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-3xl">{course.title}</CardTitle>
                <CardDescription className="text-lg mt-2">{course.code}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {userRole === "faculty" && (
                  <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
                    <Download className="w-4 h-4 mr-2" />
                    Export Data
                  </Button>
                )}
                <span className="text-sm px-3 py-1 bg-primary/10 text-primary rounded">
                  {course.semester} {course.year}
                </span>
              </div>
            </div>
            <p className="text-muted-foreground mt-4">{course.description}</p>
            <p className="text-sm mt-2">Instructor: {course.profiles?.full_name}</p>
          </CardHeader>
        </Card>

        <Tabs defaultValue="assignments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="assignments">
              <ClipboardList className="w-4 h-4 mr-2" />
              Assignments
            </TabsTrigger>
            <TabsTrigger value="materials">
              <FileText className="w-4 h-4 mr-2" />
              Materials
            </TabsTrigger>
            {userRole === "faculty" && course.faculty_id === user?.id && (
              <TabsTrigger value="students">
                <Users className="w-4 h-4 mr-2" />
                Students
              </TabsTrigger>
            )}
            <TabsTrigger value="discussions">
              <MessageSquare className="w-4 h-4 mr-2" />
              Discussions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assignments" className="space-y-4">
            {userRole === "faculty" && course.faculty_id === user?.id && (
              <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
                <DialogTrigger asChild>
                  <Button>Create Assignment</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Assignment</DialogTitle>
                    <DialogDescription>Add a new assignment for this course</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={newAssignment.title}
                        onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newAssignment.description}
                        onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="due_date">Due Date *</Label>
                      <Input
                        id="due_date"
                        type="datetime-local"
                        value={newAssignment.due_date}
                        onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="max_points">Maximum Points</Label>
                      <Input
                        id="max_points"
                        type="number"
                        value={newAssignment.max_points}
                        onChange={(e) => setNewAssignment({ ...newAssignment, max_points: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Attachment (PDF/Word)</Label>
                      <FileUpload
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onFileSelect={setAssignmentFile}
                        selectedFile={assignmentFile}
                        label="Upload assignment document"
                        description="PDF, DOC, DOCX"
                        maxSizeMB={10}
                        uploadProgress={uploadProgress}
                        isUploading={uploadingAssignment}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAssignmentDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateAssignment} disabled={uploadingAssignment}>
                      {uploadingAssignment ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            <div className="grid gap-4">
              {assignments.map((assignment) => (
                <Card key={assignment.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle>{assignment.title}</CardTitle>
                        <CardDescription className="mt-2">{assignment.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-primary" />
                        {userRole === "faculty" && course.faculty_id === user?.id && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditAssignment(assignment);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteAssignment({ id: assignment.id, title: assignment.title });
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>Due: {format(new Date(assignment.due_date), "MMM d, yyyy h:mm a")}</span>
                        </div>
                        <span>Max Points: {assignment.max_points}</span>
                        {assignment.file_name && assignment.file_path && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <DocumentPreview
                              filePath={assignment.file_path}
                              fileName={assignment.file_name}
                              bucketName="course-materials"
                            />
                          </div>
                        )}
                      </div>
                      <Button onClick={() => {
                        if (userRole === "student") {
                          navigate(`/assignments/${assignment.id}`);
                        } else {
                          navigate(`/assignments/${assignment.id}/grade`);
                        }
                      }}>
                        {userRole === "student" ? "Submit" : "Grade Submissions"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {assignments.length === 0 && (
                <Card className="p-12 text-center">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No assignments yet</p>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="materials" className="space-y-4">
            {userRole === "faculty" && course.faculty_id === user?.id && (
              <Card className="p-4 space-y-4">
                {/* Folder selector for upload */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-sm font-medium">Upload to folder:</Label>
                  <select
                    value={uploadFolder || ""}
                    onChange={(e) => setUploadFolder(e.target.value || null)}
                    className="border rounded px-2 py-1 text-sm bg-background"
                  >
                    <option value="">No folder (root)</option>
                    {[...new Set(materials.filter(m => m.folder).map(m => m.folder))].map(folder => (
                      <option key={folder} value={folder || ""}>{folder}</option>
                    ))}
                  </select>
                  {showNewFolderInput ? (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Folder name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        className="w-40 h-8"
                      />
                      <Button size="sm" onClick={() => {
                        if (newFolderName.trim()) {
                          setUploadFolder(newFolderName.trim());
                          setNewFolderName("");
                          setShowNewFolderInput(false);
                        }
                      }}>Add</Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setNewFolderName("");
                        setShowNewFolderInput(false);
                      }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setShowNewFolderInput(true)}>
                      <FolderPlus className="w-4 h-4 mr-1" /> New Folder
                    </Button>
                  )}
                </div>
                <FileUpload
                  accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,.csv,.md,.rtf,.odt,.odp,.ods"
                  onFileSelect={setMaterialFile}
                  onFilesSelect={setMaterialFiles}
                  selectedFile={materialFile}
                  selectedFiles={materialFiles}
                  label="Upload course materials (multiple supported)"
                  description="PDF, DOC, TXT, PPT, XLS, CSV"
                  maxSizeMB={20}
                  uploadProgress={materialUploadProgress}
                  isUploading={uploadingMaterial}
                  multiple={true}
                />
                {(materialFiles.length > 0 || materialFile) && !uploadingMaterial && (
                  <Button 
                    onClick={handleMaterialUpload} 
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {materialFiles.length > 1 ? `${materialFiles.length} Materials` : 'Material'}
                    {uploadFolder && ` to "${uploadFolder}"`}
                  </Button>
                )}
              </Card>
            )}

            {/* Search and Filter */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search materials..."
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={selectedFolder === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFolder(null)}
                >
                  All
                </Button>
                <Button
                  variant={selectedFolder === "" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFolder("")}
                >
                  <Folder className="w-4 h-4 mr-1" /> Root
                </Button>
                {[...new Set(materials.filter(m => m.folder).map(m => m.folder))].map(folder => (
                  <Button
                    key={folder}
                    variant={selectedFolder === folder ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFolder(folder || null)}
                  >
                    <Folder className="w-4 h-4 mr-1" /> {folder}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              {materials
                .filter(m => {
                  const matchesSearch = materialSearch === "" || 
                    m.title.toLowerCase().includes(materialSearch.toLowerCase()) ||
                    (m.description && m.description.toLowerCase().includes(materialSearch.toLowerCase()));
                  const matchesFolder = selectedFolder === null || 
                    (selectedFolder === "" ? !m.folder : m.folder === selectedFolder);
                  return matchesSearch && matchesFolder;
                })
                .map((material) => (
                <Card key={material.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getFileTypeIcon(material.title)}
                        <div>
                          <CardTitle className="text-base">{material.title}</CardTitle>
                          <div className="flex items-center gap-2">
                            {material.folder && (
                              <span className="text-xs bg-muted px-2 py-0.5 rounded flex items-center gap-1">
                                <Folder className="w-3 h-3" /> {material.folder}
                              </span>
                            )}
                            {material.description && (
                              <CardDescription>{material.description}</CardDescription>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DocumentPreview
                          filePath={material.file_path}
                          fileName={material.title}
                          bucketName="course-materials"
                        />
                        {userRole === "faculty" && course.faculty_id === user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMaterial(material.id, material.file_path)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
              {materials.filter(m => {
                const matchesSearch = materialSearch === "" || 
                  m.title.toLowerCase().includes(materialSearch.toLowerCase());
                const matchesFolder = selectedFolder === null || 
                  (selectedFolder === "" ? !m.folder : m.folder === selectedFolder);
                return matchesSearch && matchesFolder;
              }).length === 0 && (
                <Card className="p-12 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {materials.length === 0 ? "No materials uploaded yet" : "No materials match your search/filter"}
                  </p>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="students" className="space-y-4">
            <div className="flex justify-end">
              <BulkStudentImport courseId={id!} onSuccess={fetchStudents} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Enrolled Students</CardTitle>
                <CardDescription>Students enrolled in this course</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Enrolled Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((enrollment) => (
                      <TableRow key={enrollment.id}>
                        <TableCell className="font-medium">
                          {enrollment.profiles?.full_name}
                        </TableCell>
                        <TableCell>{enrollment.profiles?.email}</TableCell>
                        <TableCell>
                          {format(new Date(enrollment.enrolled_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/courses/${id}/students/${enrollment.profiles?.user_id}`)}
                          >
                            View Progress
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {students.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No students enrolled yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="discussions" className="space-y-4">
            <DiscussionForum
              courseId={id!}
              userRole={userRole}
              isFacultyOwner={userRole === "faculty" && course.faculty_id === user?.id}
            />
          </TabsContent>
        </Tabs>

        {editAssignment && (
          <EditAssignmentDialog
            assignment={editAssignment}
            open={!!editAssignment}
            onOpenChange={(open) => !open && setEditAssignment(null)}
            onSuccess={fetchAssignments}
          />
        )}

        {deleteAssignment && (
          <DeleteAssignmentDialog
            assignmentId={deleteAssignment.id}
            assignmentTitle={deleteAssignment.title}
            open={!!deleteAssignment}
            onOpenChange={(open) => !open && setDeleteAssignment(null)}
            onSuccess={fetchAssignments}
          />
        )}

        {course && (
          <ExportDataDialog
            courseId={course.id}
            courseName={`${course.code}_${course.title}`}
            open={exportDialogOpen}
            onOpenChange={setExportDialogOpen}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default CourseDetails;