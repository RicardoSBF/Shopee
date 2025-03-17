import React, { useState, useEffect } from "react";
import NavigationTabs from "./NavigationTabs";
import HomeTab from "./HomeTab";
import ScheduleTab from "./ScheduleTab";
import ConfigurationTab from "./ConfigurationTab";
import { motion, AnimatePresence } from "framer-motion";

interface MainDashboardProps {
  userName?: string;
  userID?: string;
  isAuthenticated?: boolean;
  primaryRegion?: string;
  backupRegions?: string[];
  selectedShift?: "AM" | "PM" | "OUROBOROS" | null;
  logisticsCenter?: {
    name: string;
    address: string;
    coordinates: { lat: number; lng: number };
  };
  upcomingShifts?: Array<{
    id: string;
    date: string;
    time: "AM" | "PM" | "OUROBOROS";
    status: "confirmed" | "pending" | "completed";
  }>;
  announcements?: Array<{
    id: string;
    title: string;
    content: string;
    date: string;
    important: boolean;
  }>;
}

const MainDashboard = ({
  userName = "Driver",
  userID = "DRV12345",
  isAuthenticated = true,
  primaryRegion = "Central Zone",
  backupRegions = ["North Zone", "South Zone", "East Zone"],
  selectedShift = null,
  logisticsCenter = {
    name: "Main Logistics Center",
    address: "123 Delivery St, Logistics City, LC 12345",
    coordinates: { lat: 40.7128, lng: -74.006 },
  },
  upcomingShifts = [
    { id: "1", date: "2023-06-15", time: "AM", status: "confirmed" },
    { id: "2", date: "2023-06-16", time: "PM", status: "pending" },
    { id: "3", date: "2023-06-17", time: "OUROBOROS", status: "confirmed" },
  ],
  announcements = [
    {
      id: "1",
      title: "New Route Planning System",
      content:
        "We have updated our route planning system. Please check the new features in the app.",
      date: "2023-06-10",
      important: true,
    },
    {
      id: "2",
      title: "Holiday Schedule",
      content:
        "Please note the modified schedule for the upcoming holiday season.",
      date: "2023-06-08",
      important: false,
    },
  ],
}: MainDashboardProps) => {
  const [activeTab, setActiveTab] = useState<string>("home");
  const [currentShift, setCurrentShift] = useState<
    "AM" | "PM" | "OUROBOROS" | null
  >(selectedShift);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Handle tab change from NavigationTabs component
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // Handle shift selection from ScheduleTab component
  const handleShiftSelect = (shift: "AM" | "PM" | "OUROBOROS") => {
    setCurrentShift(shift);
    // In a real implementation, this would also update the backend
  };

  // Redirect to authentication if not authenticated
  if (!isAuthenticated) {
    // In a real implementation, this would redirect to the authentication page
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-md w-full"
        >
          <h2 className="text-2xl font-bold mb-4 dark:text-white">
            Autenticação Necessária
          </h2>
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            Por favor, faça login para acessar o painel.
          </p>
          <button className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors duration-300 font-medium shadow-md hover:shadow-lg">
            Ir para Login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Navigation Tabs */}
      <NavigationTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        userName={userName}
      />

      {/* Content based on active tab */}
      <div className="container mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {activeTab === "home" && (
            <motion.div
              key="home"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <HomeTab
                userName={userName}
                logisticsCenter={logisticsCenter}
                upcomingShifts={upcomingShifts}
                announcements={announcements}
                handleTabChange={handleTabChange}
              />
            </motion.div>
          )}

          {activeTab === "schedule" && (
            <motion.div
              key="schedule"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <ScheduleTab
                currentDate={new Date()}
                selectedShift={currentShift}
                onShiftSelect={handleShiftSelect}
              />
            </motion.div>
          )}

          {activeTab === "configuration" && (
            <motion.div
              key="configuration"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <ConfigurationTab
                userName={userName}
                userID={userID}
                primaryRegion={primaryRegion}
                backupRegions={backupRegions}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MainDashboard;
