import { useState } from "react";

export function useDragDrop() {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const handleDragStart = (item: string) => {
    setDraggedItem(item);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDrop = () => {
    // Additional logic can be added here for drop handling
  };

  return {
    draggedItem,
    handleDragStart,
    handleDragEnd,
    handleDrop,
  };
}
