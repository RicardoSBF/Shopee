import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  FileSpreadsheet,
  Settings,
  ChevronDown,
  BarChart,
  Download,
  Route,
  Map,
  Bell,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import DriverTable from "./DriverTable";
import ExportOptions from "./ExportOptions";
import RouteImport from "./RouteImport";
import AvailableRoutes from "./AvailableRoutes";
import NotificationCenter from "./NotificationCenter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdminDashboardProps {
  userName?: string;
}

const AdminDashboard = ({ userName = "Admin" }: AdminDashboardProps) => {
  const [activeTab, setActiveTab] = useState("drivers");
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [driverStats, setDriverStats] = useState({
    totalDrivers: 0,
    activeToday: 0,
    amShift: 0,
    pmShift: 0,
    ouroborosShift: 0,
  });

  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      title: string;
      message: string;
      time: string;
      read: boolean;
    }>
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Dados para o relatório Excel
  const [topDrivers, setTopDrivers] = useState<
    Array<{
      id: string;
      name: string;
      deliveryRate: number;
      region: string;
      shift: string;
    }>
  >([]);

  const handleExport = (exportConfig: any) => {
    console.log("Exportando com configuração:", exportConfig);
    // Em uma implementação real, isso acionaria o processo de exportação real
    alert("Exportação iniciada com as opções selecionadas");
    setShowExportOptions(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("authenticatedUser");
    window.location.reload();
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
    document.documentElement.classList.toggle("dark");
  };

  // Fetch driver statistics from Supabase with optimized real-time updates
  useEffect(() => {
    // Set up polling for real-time updates with longer interval
    const interval = setInterval(() => {
      fetchDriverStats();
    }, 120000); // Poll every 2 minutes to reduce server load

    // Initial fetch
    fetchDriverStats();

    // Carregar notificações do localStorage
    const savedNotifications = localStorage.getItem("adminNotifications");
    if (savedNotifications) {
      const parsedNotifications = JSON.parse(savedNotifications);
      setNotifications(parsedNotifications);
      setUnreadCount(parsedNotifications.filter((n: any) => !n.read).length);
    }

    // Configurar listener para novas notificações
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "adminNotifications") {
        const updatedNotifications = e.newValue ? JSON.parse(e.newValue) : [];
        setNotifications(updatedNotifications);
        setUnreadCount(updatedNotifications.filter((n: any) => !n.read).length);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Função para adicionar uma nova notificação
  const addNotification = (title: string, message: string) => {
    const newNotification = {
      id: Date.now().toString(),
      title,
      message,
      time: new Date().toISOString(),
      read: false,
    };

    const updatedNotifications = [
      newNotification,
      ...notifications.slice(0, 19),
    ];
    setNotifications(updatedNotifications);
    setUnreadCount(updatedNotifications.filter((n) => !n.read).length);

    // Salvar no localStorage
    localStorage.setItem(
      "adminNotifications",
      JSON.stringify(updatedNotifications),
    );
  };

  // Função para marcar notificações como lidas
  const markAllAsRead = () => {
    const updatedNotifications = notifications.map((n) => ({
      ...n,
      read: true,
    }));
    setNotifications(updatedNotifications);
    setUnreadCount(0);
    localStorage.setItem(
      "adminNotifications",
      JSON.stringify(updatedNotifications),
    );
  };

  const fetchDriverStats = async () => {
    try {
      // Get total drivers count with limit to improve performance
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select(
          "id, full_name, regions(primary_region), driver_verification(delivery_fee)",
        )
        .eq("is_admin", false)
        .limit(200);

      if (usersError) {
        console.error("Error fetching users:", usersError);
        return;
      }

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split("T")[0];

      // Get active drivers today (with availability)
      const { data: activeDrivers, error: activeError } = await supabase
        .from("availability")
        .select("user_id, shift")
        .eq("date", today);

      if (activeError) {
        console.error("Error fetching active drivers:", activeError);
        return;
      }

      // Count shifts
      const amShiftDrivers =
        activeDrivers?.filter((d) => d.shift === "AM") || [];
      const pmShiftDrivers =
        activeDrivers?.filter((d) => d.shift === "PM") || [];
      const ouroborosShiftDrivers =
        activeDrivers?.filter((d) => d.shift === "OUROBOROS") || [];

      setDriverStats({
        totalDrivers: users?.length || 0,
        activeToday: activeDrivers?.length || 0,
        amShift: amShiftDrivers.length,
        pmShift: pmShiftDrivers.length,
        ouroborosShift: ouroborosShiftDrivers.length,
      });

      // Preparar dados para o relatório Excel - top motoristas por taxa de entrega
      if (users && users.length > 0) {
        const driversWithRates = users
          .filter(
            (user) =>
              user.driver_verification && user.driver_verification.length > 0,
          )
          .map((user) => ({
            id: user.id,
            name: user.full_name || "",
            deliveryRate: user.driver_verification[0]?.delivery_fee || 0,
            region:
              user.regions && user.regions.length > 0
                ? user.regions[0].primary_region
                : "Não definida",
            shift:
              activeDrivers?.find((d) => d.user_id === user.id)?.shift ||
              "NONE",
          }))
          .sort((a, b) => b.deliveryRate - a.deliveryRate)
          .slice(0, 10);

        setTopDrivers(driversWithRates);
      }
    } catch (error) {
      console.error("Error fetching driver statistics:", error);
    }
  };

  // Função para gerar relatório Excel
  const handleGenerateExcelReport = () => {
    try {
      // Criar CSV para download
      let csvContent = "data:text/csv;charset=UTF-8,\uFEFF";

      // Cabeçalhos
      const headers = [
        "ID",
        "Motorista",
        "Taxa de Entrega (%)",
        "Região Principal",
        "Turno Atual",
        "Data do Relatório",
      ];

      csvContent += headers.join(";") + "\r\n";

      // Data atual formatada
      const currentDate = format(new Date(), "dd/MM/yyyy HH:mm", {
        locale: ptBR,
      });

      // Adicionar dados ao CSV
      topDrivers.forEach((driver) => {
        const rowData = [
          `"${driver.id}"`,
          `"${driver.name}"`,
          `"${driver.deliveryRate.toFixed(2)}"`,
          `"${driver.region}"`,
          `"${driver.shift}"`,
          `"${currentDate}"`,
        ];

        csvContent += rowData.join(";") + "\r\n";
      });

      // Criar link para download
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `relatorio_motoristas_${format(new Date(), "dd-MM-yyyy", { locale: ptBR })}.csv`,
      );
      document.body.appendChild(link);

      // Simular clique para iniciar download
      link.click();

      // Remover o link
      document.body.removeChild(link);

      alert("Relatório de performance exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar relatório Excel:", error);
      alert("Ocorreu um erro ao gerar o relatório. Tente novamente.");
    }
  };

  return (
    <div
      className={`w-full min-h-screen ${theme === "dark" ? "bg-gray-900 text-white" : "bg-background"}`}
    >
      <header
        className={`${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-gradient-to-r from-orange-400 to-orange-500"} border-b border-border p-4 sticky top-0 z-10`}
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1
              className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-white"}`}
            >
              Painel do Administrador
            </h1>
            <p
              className={`${theme === "dark" ? "text-gray-300" : "text-white/80"}`}
            >
              Bem-vindo de volta, {userName}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <NotificationCenter />
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              className={`transition-all duration-300 ${theme === "dark" ? "bg-gray-700 text-white border-gray-600 hover:bg-gray-600" : "bg-white/20 text-white border-white/30 hover:bg-white/30"}`}
              onClick={toggleTheme}
            >
              {theme === "light" ? "Modo Escuro" : "Modo Claro"}
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card
            className={`transition-all duration-300 ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-orange-100 shadow-md hover:shadow-lg"}`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle
                className={`text-sm font-medium ${theme === "dark" ? "text-white" : "text-gray-800"}`}
              >
                Total de Motoristas
              </CardTitle>
              <Users
                className={`h-4 w-4 ${theme === "dark" ? "text-orange-400" : "text-orange-500"}`}
              />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
              >
                {driverStats.totalDrivers}
              </div>
              <p
                className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
              >
                Motoristas cadastrados no sistema
              </p>
            </CardContent>
          </Card>
          <Card
            className={`transition-all duration-300 ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-orange-100 shadow-md hover:shadow-lg"}`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle
                className={`text-sm font-medium ${theme === "dark" ? "text-white" : "text-gray-800"}`}
              >
                Ativos Hoje
              </CardTitle>
              <Users
                className={`h-4 w-4 ${theme === "dark" ? "text-orange-400" : "text-orange-500"}`}
              />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
              >
                {driverStats.activeToday}
              </div>
              <p
                className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
              >
                {driverStats.totalDrivers > 0
                  ? Math.round(
                      (driverStats.activeToday / driverStats.totalDrivers) *
                        100,
                    )
                  : 0}
                % do total de motoristas
              </p>
            </CardContent>
          </Card>
          <Card
            className={`transition-all duration-300 ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-orange-100 shadow-md hover:shadow-lg"}`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle
                className={`text-sm font-medium ${theme === "dark" ? "text-white" : "text-gray-800"}`}
              >
                Turno AM
              </CardTitle>
              <Users
                className={`h-4 w-4 ${theme === "dark" ? "text-orange-400" : "text-orange-500"}`}
              />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
              >
                {driverStats.amShift}
              </div>
              <p
                className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
              >
                {driverStats.activeToday > 0
                  ? Math.round(
                      (driverStats.amShift / driverStats.activeToday) * 100,
                    )
                  : 0}
                % dos motoristas ativos
              </p>
            </CardContent>
          </Card>
          <Card
            className={`transition-all duration-300 ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-orange-100 shadow-md hover:shadow-lg"}`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle
                className={`text-sm font-medium ${theme === "dark" ? "text-white" : "text-gray-800"}`}
              >
                Turno PM
              </CardTitle>
              <Users
                className={`h-4 w-4 ${theme === "dark" ? "text-orange-400" : "text-orange-500"}`}
              />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
              >
                {driverStats.pmShift}
              </div>
              <p
                className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
              >
                {driverStats.activeToday > 0
                  ? Math.round(
                      (driverStats.pmShift / driverStats.activeToday) * 100,
                    )
                  : 0}
                % dos motoristas ativos
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList
              className={`p-1 ${theme === "dark" ? "bg-gray-700" : "bg-orange-100"}`}
            >
              <TabsTrigger
                value="drivers"
                className={`flex items-center gap-2 transition-all duration-300 ${theme === "dark" ? "data-[state=active]:bg-orange-600 data-[state=active]:text-white" : "data-[state=active]:bg-orange-500 data-[state=active]:text-white"}`}
              >
                <Users className="h-4 w-4" />
                <span>Motoristas</span>
              </TabsTrigger>
              <TabsTrigger
                value="exports"
                className={`flex items-center gap-2 transition-all duration-300 ${theme === "dark" ? "data-[state=active]:bg-orange-600 data-[state=active]:text-white" : "data-[state=active]:bg-orange-500 data-[state=active]:text-white"}`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Exportações</span>
              </TabsTrigger>
              <TabsTrigger
                value="routes"
                className={`flex items-center gap-2 transition-all duration-300 ${theme === "dark" ? "data-[state=active]:bg-orange-600 data-[state=active]:text-white" : "data-[state=active]:bg-orange-500 data-[state=active]:text-white"}`}
              >
                <Route className="h-4 w-4" />
                <span>Rotas Disponíveis</span>
              </TabsTrigger>
            </TabsList>

            {activeTab === "drivers" && (
              <div className="flex gap-2">
                <RouteImport />
                <Button
                  variant="outline"
                  onClick={() => setShowExportOptions(!showExportOptions)}
                  className={`flex items-center gap-2 transition-all duration-300 ${theme === "dark" ? "bg-gray-700 text-white border-gray-600 hover:bg-gray-600" : "border-orange-200 text-orange-700 hover:bg-orange-50"}`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar Dados
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>

          <TabsContent value="drivers" className="space-y-4">
            {showExportOptions && (
              <div className="mb-6">
                <ExportOptions onExport={handleExport} />
              </div>
            )}
            <DriverTable />
          </TabsContent>

          <TabsContent value="exports" className="space-y-4">
            <ExportOptions />
          </TabsContent>

          <TabsContent value="routes" className="space-y-4">
            <Card
              className={
                theme === "dark"
                  ? "bg-gray-800 border-gray-700"
                  : "border-orange-100 shadow-md"
              }
            >
              <CardHeader>
                <CardTitle
                  className={theme === "dark" ? "text-white" : "text-gray-800"}
                >
                  Gerenciamento de Rotas
                </CardTitle>
                <CardDescription
                  className={
                    theme === "dark" ? "text-gray-400" : "text-gray-600"
                  }
                >
                  Importe e gerencie rotas para distribuição aos motoristas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 mb-6">
                  <RouteImport />
                  <AvailableRoutes />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
