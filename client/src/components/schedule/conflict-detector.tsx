import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Users, DoorOpen } from "lucide-react";
import type { ScheduleConflict } from "@shared/schema";

interface ConflictDetectorProps {
  scheduleEntries?: any[];
  onConflictDetected?: (conflicts: ScheduleConflict[]) => void;
}

export function ConflictDetector({ scheduleEntries, onConflictDetected }: ConflictDetectorProps) {
  const [detectedConflicts, setDetectedConflicts] = useState<ScheduleConflict[]>([]);

  const { data: conflicts, isLoading } = useQuery({
    queryKey: ["/api/schedule-conflicts"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  useEffect(() => {
    if (conflicts) {
      setDetectedConflicts(conflicts);
      onConflictDetected?.(conflicts);
    }
  }, [conflicts, onConflictDetected]);

  const getConflictIcon = (conflictType: string) => {
    switch (conflictType) {
      case 'room':
        return <DoorOpen className="h-4 w-4" />;
      case 'teacher':
        return <Users className="h-4 w-4" />;
      case 'time':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 border-red-500 text-red-900';
      case 'medium':
        return 'bg-yellow-100 border-yellow-500 text-yellow-900';
      case 'low':
        return 'bg-blue-100 border-blue-500 text-blue-900';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-900';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="skeleton h-16" />
        <div className="skeleton h-16" />
      </div>
    );
  }

  if (!detectedConflicts || detectedConflicts.length === 0) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <AlertTriangle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          No scheduling conflicts detected. All classes are properly scheduled.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">
          Detected Conflicts ({detectedConflicts.length})
        </h3>
        <Badge variant="destructive" className="text-xs">
          {detectedConflicts.filter(c => c.severity === 'high').length} High Priority
        </Badge>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {detectedConflicts.map((conflict) => (
          <Alert
            key={conflict.id}
            className={`border-l-4 ${getSeverityColor(conflict.severity)}`}
          >
            <div className="flex items-start space-x-2">
              {getConflictIcon(conflict.conflictType)}
              <div className="flex-1 min-w-0">
                <AlertDescription className="text-sm">
                  <div className="font-medium mb-1">
                    {conflict.conflictType.charAt(0).toUpperCase() + conflict.conflictType.slice(1)} Conflict
                  </div>
                  <div className="text-xs opacity-90">
                    {conflict.description}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        conflict.severity === 'high' ? 'border-red-300 text-red-700' :
                        conflict.severity === 'medium' ? 'border-yellow-300 text-yellow-700' :
                        'border-blue-300 text-blue-700'
                      }`}
                    >
                      {conflict.severity} priority
                    </Badge>
                    <span className="text-xs opacity-70">
                      {new Date(conflict.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </AlertDescription>
              </div>
            </div>
          </Alert>
        ))}
      </div>
    </div>
  );
}

export default ConflictDetector;
