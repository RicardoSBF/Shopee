import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { Home, Calendar, Settings, User } from "lucide-react";
import { ModeToggle } from "../ui/mode-toggle";

interface NavigationTabsProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  userName?: string;
}

// Memoize the component for better performance
const NavigationTabs = React.memo(
  ({
    activeTab = "home",
    onTabChange,
    userName = "Motorista",
  }: NavigationTabsProps) => {
    const [currentTab, setCurrentTab] = useState(activeTab);

    const handleTabChange = (value: string) => {
      setCurrentTab(value);
      if (onTabChange) {
        onTabChange(value);
      }
    };

    return (
      <div className="w-full border-b border-gray-200 shadow-md bg-gradient-to-r from-orange-400 to-orange-500 dark:from-orange-600 dark:to-orange-700">
        <div className="w-full max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center py-2">
            <div className="mr-4 flex items-center">
              <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center mr-2">
                <User className="h-5 w-5 text-orange-500" />
              </div>
              <span className="text-white font-medium hidden md:inline-block">
                {userName}
              </span>
            </div>
            <ModeToggle />
          </div>
          <Tabs
            defaultValue={currentTab}
            onValueChange={handleTabChange}
            className="w-full max-w-md"
          >
            <TabsList className="grid w-full grid-cols-3 bg-orange-500/20 dark:bg-orange-800/30">
              <TabsTrigger
                value="home"
                className="flex items-center justify-center gap-2 py-3 transition-all duration-200 hover:bg-orange-600/20 data-[state=active]:bg-white/20 data-[state=active]:text-white"
              >
                <Home className="h-5 w-5" />
                <span className="hidden sm:inline font-medium">Início</span>
              </TabsTrigger>
              <TabsTrigger
                value="schedule"
                className="flex items-center justify-center gap-2 py-3 transition-all duration-200 hover:bg-orange-600/20 data-[state=active]:bg-white/20 data-[state=active]:text-white"
              >
                <Calendar className="h-5 w-5" />
                <span className="hidden sm:inline font-medium">Agenda</span>
              </TabsTrigger>
              <TabsTrigger
                value="configuration"
                className="flex items-center justify-center gap-2 py-3 transition-all duration-200 hover:bg-orange-600/20 data-[state=active]:bg-white/20 data-[state=active]:text-white"
              >
                <Settings className="h-5 w-5" />
                <span className="hidden sm:inline font-medium">
                  Configuração
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="w-24"></div> {/* Spacer for balance */}
        </div>
      </div>
    );
  },
);

export default NavigationTabs;
