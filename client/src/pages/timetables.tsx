import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";
import { Calendar, Download, Upload, Plus } from "lucide-react";

export default function Timetables() {
  const [selectedWeek, setSelectedWeek] = useState(new Date());

  const { data: scheduleEntries, isLoading } = useQuery({
    queryKey: ["/api/schedule-entries", selectedWeek.toISOString()],
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Timetable Management</h1>
          <p className="text-gray-600 mt-1">Create and manage school schedules</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Class
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  Weekly Schedule
                </CardTitle>
                <div className="text-sm text-gray-500">
                  Week of {selectedWeek.toLocaleDateString()} - {new Date(selectedWeek.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="skeleton h-20" />
                  ))}
                </div>
              ) : (
                <ScheduleGrid />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full justify-start" variant="outline">
                Auto-Generate Schedule
              </Button>
              <Button className="w-full justify-start" variant="outline">
                Detect Conflicts
              </Button>
              <Button className="w-full justify-start" variant="outline">
                Copy From Previous Week
              </Button>
              <Button className="w-full justify-start" variant="outline">
                Clear All
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-blue-200 border-l-4 border-blue-500 rounded"></div>
                <span className="text-sm">Mathematics</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-green-200 border-l-4 border-green-500 rounded"></div>
                <span className="text-sm">Science</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-orange-200 border-l-4 border-orange-500 rounded"></div>
                <span className="text-sm">Languages</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-purple-200 border-l-4 border-purple-500 rounded"></div>
                <span className="text-sm">Arts</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
