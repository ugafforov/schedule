import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, DoorOpen } from "lucide-react";
import type { Room } from "@shared/schema";

export default function Rooms() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["/api/rooms"],
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/rooms/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete room");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      toast({
        title: "Success",
        description: "Room deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete room",
        variant: "destructive",
      });
    },
  });

  const filteredRooms = rooms?.filter((room: Room) =>
    room.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.roomNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.building?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    room.roomType?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getRoomTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'classroom': return 'bg-blue-100 text-blue-800';
      case 'lab': return 'bg-green-100 text-green-800';
      case 'auditorium': return 'bg-purple-100 text-purple-800';
      case 'library': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rooms</h1>
          <p className="text-gray-600 mt-1">Manage school rooms and facilities</p>
        </div>
        
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Room
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <DoorOpen className="mr-2 h-5 w-5" />
              Room Directory
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search rooms..."
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
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton h-20" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map((room: Room) => (
                <Card key={room.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{room.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">Room {room.roomNumber}</p>
                        {room.building && (
                          <p className="text-sm text-gray-500">
                            {room.building} {room.floor && `- Floor ${room.floor}`}
                          </p>
                        )}
                        
                        <div className="flex items-center space-x-2 mt-3">
                          <Badge className={getRoomTypeColor(room.roomType)}>
                            {room.roomType}
                          </Badge>
                          <Badge variant={room.isActive ? "default" : "secondary"}>
                            {room.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        
                        <p className="text-xs text-gray-500 mt-2">
                          Capacity: {room.capacity} people
                        </p>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => deleteRoomMutation.mutate(room.id)}
                          disabled={deleteRoomMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          {!isLoading && filteredRooms.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? "No rooms found matching your search." : "No rooms found. Add your first room to get started."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
