import { useQuery } from "@tanstack/react-query";
import { StatsCards } from "@/components/stats/stats-cards";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TriangleAlert, 
  WandSparkles, 
  RectangleEllipsis,
  File,
  PlusIcon,
  DownloadIcon
} from "lucide-react";
import { AlertTriangle, Wand2, Mail, FileText, Plus, Download } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: conflicts, isLoading: conflictsLoading } = useQuery({
    queryKey: ["/api/schedule-conflicts"],
  });

  if (statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <StatsCards stats={stats} />
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Weekly Schedule View */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">Weekly Schedule</CardTitle>
                  <p className="text-sm text-gray-500">Week of March 11-17, 2024</p>
                </div>
                <div className="flex items-center space-x-3">
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New Class
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScheduleGrid />
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Schedule Conflicts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg font-semibold">
                <AlertTriangle className="text-orange-500 mr-2 h-5 w-5" />
                Schedule Conflicts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {conflictsLoading ? (
                <div className="skeleton h-20" />
              ) : conflicts && conflicts.length > 0 ? (
                conflicts.slice(0, 3).map((conflict: any) => (
                  <div key={conflict.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-red-900">
                          {conflict.conflictType === 'room' ? 'Room Double Booking' : 
                           conflict.conflictType === 'teacher' ? 'Teacher Conflict' : 'Class Overlap'}
                        </h4>
                        <p className="text-sm text-red-700 mt-1">{conflict.description}</p>
                        <p className="text-xs text-red-600 mt-2">
                          {new Date(conflict.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-800">
                        ×
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No active conflicts</p>
              )}
              
              {conflicts && conflicts.length > 3 && (
                <Button variant="ghost" className="w-full text-sm text-blue-600 hover:text-blue-800">
                  View All Conflicts ({conflicts.length})
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="ghost" className="w-full justify-start p-4 h-auto">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mr-3">
                  <Wand2 className="text-blue-500 h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Auto-Schedule</p>
                  <p className="text-xs text-gray-500">Generate optimized timetable</p>
                </div>
              </Button>
              
              <Button variant="ghost" className="w-full justify-start p-4 h-auto">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mr-3">
                  <FileText className="text-green-500 h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Import Data</p>
                  <p className="text-xs text-gray-500">Upload CSV files</p>
                </div>
              </Button>
              
              <Button variant="ghost" className="w-full justify-start p-4 h-auto">
                <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center mr-3">
                  <Mail className="text-orange-500 h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Send Notifications</p>
                  <p className="text-xs text-gray-500">Email schedule updates</p>
                </div>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Plus className="text-blue-500 text-sm h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Added new class: Advanced Calculus</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="text-orange-500 text-sm h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Resolved scheduling conflict in Room 205</p>
                  <p className="text-xs text-gray-500">4 hours ago</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <Download className="text-green-500 text-sm h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Prof. Anderson updated availability</p>
                  <p className="text-xs text-gray-500">6 hours ago</p>
                </div>
              </div>
              
              <Button variant="ghost" className="w-full text-sm text-blue-600 hover:text-blue-800">
                View All Activity
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
