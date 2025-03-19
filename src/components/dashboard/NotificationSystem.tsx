import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface NotificationSystemProps {
  userId: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({ userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Function to add notification
  const addNotification = (title: string, message: string) => {
    const newNotification = {
      id: Date.now().toString(),
      title,
      message,
      time: new Date().toISOString(),
      read: false,
    };

    // Get existing notifications
    const savedNotifications = localStorage.getItem("driverNotifications");
    const existingNotifications = savedNotifications
      ? JSON.parse(savedNotifications)
      : [];

    // Add new notification at the beginning
    const updatedNotifications = [newNotification, ...existingNotifications];

    // Save to localStorage with encryption
    try {
      localStorage.setItem(
        "driverNotifications",
        JSON.stringify(updatedNotifications),
      );

      // Update state
      setNotifications(updatedNotifications);

      // Dispatch event to update other tabs/windows
      window.dispatchEvent(new CustomEvent("notification-added"));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "driverNotifications",
          newValue: JSON.stringify(updatedNotifications),
        }),
      );

      // Play notification sound with reduced volume
      const audio = new Audio("/notification-sound.mp3");
      audio.volume = 0.2; // Reduce volume to 20% of original
      audio.play().catch((err) => console.error("Error playing sound:", err));
    } catch (error) {
      console.error("Error processing notification:", error);
    }
  };

  // Set up realtime subscription for route assignments
  useEffect(() => {
    if (!userId) return;

    // Initial check for recent assignments
    const checkRouteAssignments = async () => {
      try {
        // Fetch recently updated route assignments
        const { data: assignmentData, error: assignmentError } = await supabase
          .from("route_assignments")
          .select("*, routes(*)")
          .eq("driver_id", userId)
          .order("updated_at", { ascending: false })
          .limit(5);

        if (assignmentError) {
          console.error("Error fetching assignments:", assignmentError);
          return;
        }

        if (assignmentData && assignmentData.length > 0) {
          // Check for recently approved or rejected assignments
          const recentAssignments = assignmentData.filter(
            (assignment) =>
              assignment.status === "approved" ||
              assignment.status === "rejected",
          );

          for (const assignment of recentAssignments) {
            // Check if we've already notified about this update
            const notificationKey = `notified_${assignment.id}_${assignment.status}`;
            const alreadyNotified = localStorage.getItem(notificationKey);

            if (!alreadyNotified && assignment.routes) {
              const routeData = assignment.routes;

              // Create notification
              const title =
                assignment.status === "approved"
                  ? "Solicitação de rota aprovada"
                  : "Solicitação de rota recusada";

              const message =
                assignment.status === "approved"
                  ? `Sua solicitação para a rota em ${routeData.city} (${routeData.shift}) foi aprovada. Você pode ver os detalhes na aba Rotas.`
                  : `Sua solicitação para a rota em ${routeData.city} (${routeData.shift}) foi recusada pelo administrador.`;

              // Add notification
              addNotification(title, message);

              // Mark as notified
              localStorage.setItem(notificationKey, "true");

              // Play notification sound
              try {
                const audio = new Audio("/notification-sound.mp3");
                audio.volume = 0.3;
                audio.play();
              } catch (soundError) {
                console.error("Error playing notification sound:", soundError);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error checking route updates:", error);
      }
    };

    // Check immediately
    checkRouteAssignments();

    // Set up realtime subscription for route_assignments table
    const subscription = supabase
      .channel("route_assignments_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "route_assignments",
          filter: `driver_id=eq.${userId}`,
        },
        async (payload) => {
          console.log("Received realtime update:", payload);
          // When a change is detected, check for updates
          await checkRouteAssignments();
        },
      )
      .subscribe();

    // Also set up periodic checking as a fallback
    const interval = setInterval(checkRouteAssignments, 30000); // Check every 30 seconds

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [userId]);

  // Component doesn't render anything visually
  return null;
};

export default NotificationSystem;
