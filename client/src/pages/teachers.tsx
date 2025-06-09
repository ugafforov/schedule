import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Users } from "lucide-react";
import type { Teacher } from "@shared/schema";

export default function Teachers() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: teachers, isLoading } = useQuery({
    queryKey: ["/api/teachers"],
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/teachers/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete teacher");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      toast({
        title: "Success",
        description: "Teacher deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete teacher",
        variant: "destructive",
      });
    },
  });

  const filteredTeachers = teachers?.filter((teacher: Teacher) =>
    teacher.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    teacher.specialization?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teachers</h1>
          <p className="text-gray-600 mt-1">Manage teaching staff and their information</p>
        </div>
        
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Teacher
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Teacher Directory
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search teachers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-20" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeachers.map((teacher: Teacher) => (
                <Card key={teacher.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{teacher.employeeId}</h3>
                        <p className="text-sm text-gray-600 mt-1">{teacher.department}</p>
                        <p className="text-sm text-gray-500">{teacher.specialization}</p>
                        
                        <div className="flex items-center space-x-2 mt-3">
                          <Badge variant={teacher.isActive ? "default" : "secondary"}>
                            {teacher.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {teacher.maxHoursPerWeek}h/week max
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteTeacherMutation.mutate(teacher.id)}
                          disabled={deleteTeacherMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {teacher.phone && (
                      <p className="text-xs text-gray-500 mt-2">📞 {teacher.phone}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {!isLoading && filteredTeachers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? "No teachers found matching your search." : "No teachers found. Add your first teacher to get started."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
