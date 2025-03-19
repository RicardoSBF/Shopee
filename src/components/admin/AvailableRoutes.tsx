import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import {
  Calendar,
  MapPin,
  Truck,
  Search,
  Route,
  Loader2,
  Package,
  Map,
  Trash2,
  Eye,
  AlertTriangle,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  HourglassIcon,
  User,
  Car,
  CheckCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import RouteDetails from "./RouteDetails";

interface RouteData {
  id: string;
  fileName: string;
  city: string;
  neighborhoods: string[];
  totalDistance: number;
  sequence: number;
  shift: "AM" | "PM" | "OUROBOROS";
  date: string;
  createdAt: string;
  assignedDriver?: string;
  deliveryRate?: number;
  isAssigned?: boolean;
  selected?: boolean;
  rawData?: any[];
  is_pending?: boolean;
  pending_since?: string;
}

// Componente para exibir informações dos motoristas pendentes
const PendingDriverInfo = ({ routeId }: { routeId: string }) => {
  const [driversInfo, setDriversInfo] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDriversInfo = async () => {
      try {
        // Buscar todas as atribuições de rota pendentes para esta rota
        const { data: assignmentsData, error: assignmentsError } =
          await supabase
            .from("route_assignments")
            .select("*")
            .eq("route_id", routeId)
            .eq("status", "pending");

        if (
          assignmentsError ||
          !assignmentsData ||
          assignmentsData.length === 0
        ) {
          console.error("Erro ao buscar atribuições:", assignmentsError);
          setIsLoading(false);
          return;
        }

        // Buscar informações de todos os motoristas
        const driversData = [];
        for (const assignment of assignmentsData) {
          // Buscar informações do motorista
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("id, full_name, phone_number")
            .eq("id", assignment.driver_id)
            .single();

          if (userError || !userData) {
            console.error("Erro ao buscar usuário:", userError);
            continue;
          }

          // Buscar informações de região do motorista
          const { data: regionData, error: regionError } = await supabase
            .from("regions")
            .select("primary_region")
            .eq("user_id", userData.id)
            .single();

          driversData.push({
            ...userData,
            assignmentId: assignment.id,
            region: regionData?.primary_region || "Não definida",
            vehicle: "Carro", // Valor padrão, poderia vir de uma tabela de veículos
          });
        }

        setDriversInfo(driversData);
      } catch (error) {
        console.error("Erro ao buscar informações dos motoristas:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDriversInfo();
  }, [routeId]);

  const handleApproveReject = async (
    driverId: string,
    assignmentId: string,
    approve: boolean,
  ) => {
    try {
      setIsLoading(true);

      // Atualizar status da atribuição
      const { error: updateError } = await supabase
        .from("route_assignments")
        .update({
          status: approve ? "approved" : "rejected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", assignmentId);

      if (updateError) throw updateError;

      // Se aprovado, atualizar a rota como atribuída
      if (approve) {
        // Primeiro, rejeitar todas as outras solicitações para esta rota
        const { error: rejectError } = await supabase
          .from("route_assignments")
          .update({
            status: "rejected",
            updated_at: new Date().toISOString(),
          })
          .eq("route_id", routeId)
          .neq("id", assignmentId);

        if (rejectError) {
          console.error("Erro ao rejeitar outras solicitações:", rejectError);
        }

        // Obter nome do motorista aprovado
        const selectedDriver = driversInfo.find(
          (d) => d.assignmentId === assignmentId,
        );
        const driverName = selectedDriver
          ? selectedDriver.full_name
          : "Motorista";

        // Atualizar a rota como atribuída
        const { error: routeError } = await supabase
          .from("routes")
          .update({
            is_pending: false,
            is_assigned: true,
            assigned_driver: driverName,
            driver_id: driverId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", routeId);

        if (routeError) throw routeError;
      } else {
        // Se rejeitado, verificar se ainda há solicitações pendentes
        const { data: pendingAssignments, error: checkError } = await supabase
          .from("route_assignments")
          .select("id")
          .eq("route_id", routeId)
          .eq("status", "pending");

        // Se não houver mais solicitações pendentes, remover o status de pendente da rota
        if (
          !checkError &&
          (!pendingAssignments || pendingAssignments.length === 0)
        ) {
          const { error: routeError } = await supabase
            .from("routes")
            .update({
              is_pending: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", routeId);

          if (routeError) throw routeError;
        }
      }

      // Atualizar a lista de motoristas
      const selectedDriver = driversInfo.find(
        (d) => d.assignmentId === assignmentId,
      );
      const driverName = selectedDriver
        ? selectedDriver.full_name
        : "Motorista";

      toast({
        title: approve ? "Solicitação aprovada" : "Solicitação recusada",
        description: `A solicitação do motorista ${driverName} foi ${approve ? "aprovada" : "recusada"} com sucesso.`,
        variant: "default",
      });

      // Atualizar a lista de motoristas
      setDriversInfo((prevDrivers) => {
        return prevDrivers.map((driver) => {
          if (driver.assignmentId === assignmentId) {
            return { ...driver, status: approve ? "approved" : "rejected" };
          } else if (approve) {
            // Se um motorista foi aprovado, todos os outros são automaticamente rejeitados
            return { ...driver, status: "rejected" };
          }
          return driver;
        });
      });
    } catch (error) {
      console.error("Erro ao processar solicitação:", error);
      toast({
        title: "Erro",
        description: "Não foi possível processar a solicitação.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-2">
        <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
        <span className="ml-2 text-sm text-amber-700">Carregando...</span>
      </div>
    );
  }

  if (!driversInfo || driversInfo.length === 0) {
    return (
      <div className="text-sm text-amber-700 pl-6">
        Nenhuma informação disponível sobre os motoristas.
      </div>
    );
  }

  return (
    <div className="pl-6 space-y-4">
      <h4 className="font-medium text-amber-800">
        Motoristas solicitando esta rota:
      </h4>

      {driversInfo.map((driver) => (
        <div
          key={driver.assignmentId}
          className="border-b border-amber-100 pb-3 last:border-0"
        >
          {/* Se já foi processado, mostrar apenas o status */}
          {driver.status ? (
            <div
              className={`flex items-center gap-2 ${driver.status === "approved" ? "text-green-700" : "text-red-700"}`}
            >
              {driver.status === "approved" ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>Solicitação de {driver.full_name} aprovada</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  <span>Solicitação de {driver.full_name} recusada</span>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-700">
                  {driver.full_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-700">{driver.vehicle}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-700">{driver.region}</span>
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-red-200 hover:bg-red-50 text-red-600"
                  onClick={() =>
                    handleApproveReject(driver.id, driver.assignmentId, false)
                  }
                  disabled={isLoading}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Recusar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-green-200 hover:bg-green-50 text-green-600"
                  onClick={() =>
                    handleApproveReject(driver.id, driver.assignmentId, true)
                  }
                  disabled={isLoading}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  Aprovar
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const AvailableRoutes = () => {
  const { toast } = useToast();

  // Estado para o diálogo de detalhes da rota
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [showRouteDetails, setShowRouteDetails] = useState(false);

  // Função para adicionar notificação ao sistema
  const addNotification = (title: string, message: string) => {
    const newNotification = {
      id: Date.now().toString(),
      title,
      message,
      time: new Date().toISOString(),
      read: false,
    };

    // Obter notificações existentes
    const savedNotifications = localStorage.getItem("adminNotifications");
    const existingNotifications = savedNotifications
      ? JSON.parse(savedNotifications)
      : [];

    // Adicionar nova notificação no início e limitar a 20
    const updatedNotifications = [
      newNotification,
      ...existingNotifications.slice(0, 19),
    ];

    // Salvar no localStorage
    localStorage.setItem(
      "adminNotifications",
      JSON.stringify(updatedNotifications),
    );

    // Disparar evento para atualizar outras abas/janelas
    try {
      window.dispatchEvent(
        new CustomEvent("admin-notification", {
          detail: { notifications: updatedNotifications },
        }),
      );

      // Também disparar evento de notificação para compatibilidade
      window.dispatchEvent(new CustomEvent("notification-added"));

      // Também disparar evento de armazenamento para compatibilidade
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "adminNotifications",
          newValue: JSON.stringify(updatedNotifications),
        }),
      );
    } catch (error) {
      console.error("Erro ao disparar evento de notificação:", error);
    }
  };

  // Configurar limpeza automática de notificações a cada 3 dias
  useEffect(() => {
    // Função para limpar notificações antigas
    const cleanupNotifications = () => {
      const lastCleanup = localStorage.getItem("lastNotificationCleanup");
      const now = new Date().getTime();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000; // 3 dias em milissegundos

      // Verificar se já se passaram 3 dias desde a última limpeza
      if (!lastCleanup || now - parseInt(lastCleanup) > threeDaysMs) {
        // Limpar notificações
        localStorage.removeItem("adminNotifications");
        // Atualizar data da última limpeza
        localStorage.setItem("lastNotificationCleanup", now.toString());
        console.log("Notificações administrativas limpas automaticamente");
      }
    };

    // Executar limpeza ao iniciar
    cleanupNotifications();

    // Configurar verificação diária
    const dailyCheck = setInterval(cleanupNotifications, 24 * 60 * 60 * 1000); // Verificar a cada 24 horas

    return () => clearInterval(dailyCheck);
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [filteredRoutes, setFilteredRoutes] = useState<RouteData[]>([]);
  const [selectedShift, setSelectedShift] = useState<
    "ALL" | "AM" | "PM" | "OUROBOROS"
  >("ALL");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNeighborhoods, setShowNeighborhoods] = useState<{
    [key: string]: boolean;
  }>({});
  const [showDriverInfo, setShowDriverInfo] = useState<{
    [key: string]: boolean;
  }>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);

  // Função para lidar com eventos de atualização de rotas
  useEffect(() => {
    const handleRouteUpdate = () => {
      console.log("Evento de atualização de rotas recebido");
      fetchRoutes();
    };

    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key === "importedRoutes") {
        console.log("Evento de armazenamento para importedRoutes recebido");
        fetchRoutes();
      }
    };

    // Adicionar listener para o evento personalizado
    window.addEventListener("routes-updated", handleRouteUpdate);
    window.addEventListener("storage", handleStorageUpdate);

    // Carregar rotas imediatamente
    fetchRoutes();

    // Limpar listener ao desmontar
    return () => {
      window.removeEventListener("routes-updated", handleRouteUpdate);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, []);

  // Carregar rotas do Supabase e localStorage com otimização de performance
  const fetchRoutes = async () => {
    setIsLoading(true);
    try {
      console.log("Iniciando busca de rotas no Supabase");

      // Verificar conexão com Supabase antes de buscar dados
      try {
        const { data: testData } = await supabase
          .from("routes")
          .select("count")
          .limit(1);
        console.log("Teste de conexão com Supabase:", testData);
      } catch (connError) {
        console.error("Erro na conexão com Supabase:", connError);
      }

      // Buscar rotas do Supabase com limite para melhorar performance
      const { data, error } = await supabase
        .from("routes")
        .select(
          "*, route_assignments(id, driver_id, status, created_at, updated_at)",
        )
        .order("created_at", { ascending: false });

      console.log("Resposta do Supabase:", { data, error });

      if (error) {
        console.error("Erro ao buscar rotas do Supabase:", error);
        // Definir arrays vazios em caso de erro
        setRoutes([]);
        setFilteredRoutes([]);
        setAvailableDates([]);
        setSelectedDate("");
      } else if (data && data.length > 0) {
        console.log("Rotas carregadas do Supabase:", data.length);
        // Transformar dados do Supabase para o formato RouteData com otimização
        const formattedRoutes: RouteData[] = data.map((route) => ({
          id: route.id,
          fileName: route.file_name,
          city: route.city,
          neighborhoods: route.neighborhoods || [],
          totalDistance: route.total_distance || 0,
          sequence: route.sequence || 0,
          shift: route.shift,
          date: route.date,
          createdAt: route.created_at,
          assignedDriver: route.assigned_driver || undefined,
          deliveryRate: route.delivery_rate || undefined,
          isAssigned: !!route.assigned_driver,
          rawData: route.raw_data || undefined,
          is_pending: route.is_pending || false,
          pending_since: route.pending_since || null,
        }));

        setRoutes(formattedRoutes);
        processRoutes(formattedRoutes);
      } else {
        console.log("Nenhuma rota encontrada no Supabase");

        // Se não houver dados no Supabase nem no localStorage, definir arrays vazios
        setRoutes([]);
        setFilteredRoutes([]);
        setAvailableDates([]);
        setSelectedDate("");
      }
    } catch (error) {
      console.error("Erro geral ao buscar rotas:", error);

      setRoutes([]);
      setFilteredRoutes([]);
      setAvailableDates([]);
      setSelectedDate("");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Efeito para configurar verificação periódica para atualizações em tempo real
  useEffect(() => {
    // Configurar verificação periódica para atualizações em tempo real
    const intervalId = setInterval(() => {
      fetchRoutes();
    }, 15000); // Verificar a cada 15 segundos (otimizado para reduzir chamadas)

    return () => clearInterval(intervalId);
  }, []);

  // Processar rotas para extrair datas disponíveis e aplicar filtros iniciais
  const processRoutes = (routesList: RouteData[]) => {
    if (!routesList || routesList.length === 0) {
      console.log("Nenhuma rota para processar");
      setFilteredRoutes([]);
      setAvailableDates([]);
      setSelectedDate(""); // Limpar a data selecionada quando não há rotas
      return;
    }

    console.log("Processando rotas:", routesList.length);

    // Extrair datas únicas disponíveis e garantir que são válidas
    const dates = [...new Set(routesList.map((route) => route.date))]
      .filter((date) => date && date.trim() !== "")
      .sort();
    console.log("Datas disponíveis:", dates);

    // Garantir que temos datas válidas
    if (dates.length === 0) {
      // Se não temos datas, usar a data atual
      const today = format(new Date(), "yyyy-MM-dd");
      dates.push(today);
      console.log("Usando data atual como fallback:", today);
    }

    setAvailableDates(dates);

    // Definir data padrão se não estiver selecionada
    if ((!selectedDate || !dates.includes(selectedDate)) && dates.length > 0) {
      console.log("Definindo data padrão:", dates[0]);
      setSelectedDate(dates[0]);
    }

    // Aplicar filtros
    applyFilters(
      routesList,
      selectedShift,
      selectedDate || (dates.length > 0 ? dates[0] : ""),
      searchTerm,
    );
  };

  // Aplicar filtros às rotas
  const applyFilters = (
    routesList: RouteData[],
    shift: "ALL" | "AM" | "PM" | "OUROBOROS",
    date: string,
    search: string,
  ) => {
    if (!routesList || routesList.length === 0) {
      console.log("Nenhuma rota para filtrar");
      setFilteredRoutes([]);
      return;
    }

    console.log("Aplicando filtros:", {
      shift,
      date,
      search,
      totalRoutes: routesList.length,
    });
    let filtered = [...routesList];

    // Filtrar por data
    if (date) {
      filtered = filtered.filter((route) => route.date === date);
      console.log(`Após filtro de data (${date}):`, filtered.length);
    }

    // Filtrar por turno
    if (shift !== "ALL") {
      filtered = filtered.filter((route) => route.shift === shift);
      console.log(`Após filtro de turno (${shift}):`, filtered.length);
    }

    // Filtrar por termo de busca
    if (search && search.trim() !== "") {
      const searchLower = search.toLowerCase().trim();
      filtered = filtered.filter(
        (route) =>
          (route.city && route.city.toLowerCase().includes(searchLower)) ||
          (route.fileName &&
            route.fileName.toLowerCase().includes(searchLower)) ||
          (route.neighborhoods &&
            route.neighborhoods.some(
              (n) => n && n.toLowerCase().includes(searchLower),
            )),
      );
      console.log(`Após filtro de busca (${search}):`, filtered.length);
    }

    // Filtrar apenas rotas pendentes se a opção estiver ativada
    if (showPendingOnly) {
      filtered = filtered.filter((route) => route.is_pending === true);
      console.log(`Após filtro de pendentes:`, filtered.length);
    }

    // Filtrar apenas rotas atribuídas se a opção estiver ativada
    if (showAssignedOnly) {
      filtered = filtered.filter((route) => route.isAssigned === true);
      console.log(`Após filtro de atribuídas:`, filtered.length);
    }

    console.log("Rotas filtradas final:", filtered.length);
    setFilteredRoutes(filtered);
  };

  // Atualizar filtros quando os valores mudarem - com debounce para melhorar performance
  useEffect(() => {
    const debouncedFilter = setTimeout(() => {
      if (routes.length === 0) {
        setFilteredRoutes([]);
        return;
      }
      applyFilters(routes, selectedShift, selectedDate, searchTerm);
    }, 150); // Pequeno delay para evitar múltiplas renderizações

    return () => clearTimeout(debouncedFilter);
  }, [
    selectedShift,
    selectedDate,
    searchTerm,
    routes,
    showPendingOnly,
    showAssignedOnly,
  ]);

  // Formatar data para exibição
  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return "";
      const date = parseISO(dateString);
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch (error) {
      console.error("Erro ao formatar data:", error, dateString);
      return dateString || "";
    }
  };

  // Função para verificar se uma string é uma data válida
  const isValidDate = (dateString: string) => {
    try {
      if (!dateString) return false;
      const date = parseISO(dateString);
      return isValid(date);
    } catch (error) {
      console.error("Erro ao validar data:", error);
      return false;
    }
  };

  // Formatar o turno para exibição
  const formatShift = (shift: "AM" | "PM" | "OUROBOROS") => {
    switch (shift) {
      case "AM":
        return "AM (3:30 - 7:30)";
      case "PM":
        return "PM (11:00 - 13:30)";
      case "OUROBOROS":
        return "OUROBOROS (15:00 - 17:30)";
      default:
        return shift;
    }
  };

  // Obter a cor do badge do turno
  const getShiftBadgeClass = (shift: "AM" | "PM" | "OUROBOROS") => {
    switch (shift) {
      case "AM":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "PM":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "OUROBOROS":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "";
    }
  };

  // Lidar com visualização de detalhes da rota
  const handleViewRouteDetails = (route: RouteData) => {
    setSelectedRoute(route);
    setShowRouteDetails(true);
  };

  // Função para atualizar manualmente as rotas
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchRoutes();
  };

  // Função para excluir múltiplas rotas
  const handleDeleteMultipleRoutes = async () => {
    if (selectedRoutes.length === 0) return;

    try {
      setIsLoading(true);

      // Excluir todas as rotas selecionadas
      const { error: deleteError } = await supabase
        .from("routes")
        .delete()
        .in("id", selectedRoutes);

      if (deleteError) {
        console.error(`Erro ao excluir rotas:`, deleteError);
        throw deleteError;
      }

      // Cancelar todas as atribuições relacionadas a estas rotas
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("route_assignments")
        .select("id")
        .in("route_id", selectedRoutes);

      if (!assignmentsError && assignmentsData && assignmentsData.length > 0) {
        const assignmentIds = assignmentsData.map((a) => a.id);
        const { error: updateError } = await supabase
          .from("route_assignments")
          .update({ status: "cancelled" })
          .in("id", assignmentIds);

        if (updateError) {
          console.error("Erro ao cancelar atribuições de rota:", updateError);
        }
      }

      // Remover também do localStorage se existir
      const savedRoutes = localStorage.getItem("importedRoutes");
      if (savedRoutes) {
        const parsedRoutes = JSON.parse(savedRoutes);
        const updatedRoutes = parsedRoutes.filter(
          (r: any) => !selectedRoutes.includes(r.id),
        );
        localStorage.setItem("importedRoutes", JSON.stringify(updatedRoutes));
      }

      // Atualizar listas de rotas
      const deletedRoutes = routes.filter((route) =>
        selectedRoutes.includes(route.id),
      );
      setRoutes((prev) =>
        prev.filter((route) => !selectedRoutes.includes(route.id)),
      );
      setFilteredRoutes((prev) =>
        prev.filter((route) => !selectedRoutes.includes(route.id)),
      );

      // Forçar uma atualização imediata
      setTimeout(() => {
        fetchRoutes();
      }, 500);

      // Adicionar notificação para rotas excluídas
      if (deletedRoutes.length > 0) {
        const notificationTitle = "Rotas excluídas";
        const notificationMessage = `${deletedRoutes.length} rota(s) foram excluídas com sucesso.`;
        addNotification(notificationTitle, notificationMessage);
      }

      // Mostrar notificação
      toast({
        title: "Rotas excluídas",
        description: `${selectedRoutes.length} rota(s) foram excluídas com sucesso.`,
        variant: "default",
      });

      // Limpar seleção
      setSelectedRoutes([]);
      setShowDeleteConfirm(false);
      setMultiSelectMode(false);
    } catch (error) {
      console.error("Erro ao excluir rotas:", error);
      toast({
        title: "Erro ao excluir",
        description:
          "Não foi possível excluir as rotas selecionadas. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end bg-white p-5 rounded-xl shadow-md border border-orange-100">
        <div className="space-y-2 flex-1">
          <Label
            htmlFor="date-filter"
            className="text-gray-700 font-medium flex items-center gap-2"
          >
            <Calendar className="h-4 w-4 text-orange-500" />
            Data
          </Label>
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger
              id="date-filter"
              className="w-full rounded-lg border-orange-200 focus:ring-orange-500 focus:border-orange-500 shadow-sm"
            >
              <SelectValue placeholder="Selecione uma data" />
            </SelectTrigger>
            <SelectContent className="rounded-lg border-orange-200">
              {availableDates.length > 0 ? (
                availableDates.map((date) => (
                  <SelectItem
                    key={date}
                    value={date}
                    className="hover:bg-orange-50"
                  >
                    {formatDate(date)}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-dates" disabled>
                  Nenhuma data disponível
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 flex-1">
          <Label
            htmlFor="shift-filter"
            className="text-gray-700 font-medium flex items-center gap-2"
          >
            <Clock className="h-4 w-4 text-orange-500" />
            Turno
          </Label>
          <Select
            value={selectedShift}
            onValueChange={(value) =>
              setSelectedShift(value as "ALL" | "AM" | "PM" | "OUROBOROS")
            }
          >
            <SelectTrigger
              id="shift-filter"
              className="w-full rounded-lg border-orange-200 focus:ring-orange-500 focus:border-orange-500 shadow-sm"
            >
              <SelectValue placeholder="Selecione um turno" />
            </SelectTrigger>
            <SelectContent className="rounded-lg border-orange-200">
              <SelectItem value="ALL" className="hover:bg-orange-50">
                Todos os Turnos
              </SelectItem>
              <SelectItem value="AM" className="hover:bg-orange-50">
                AM (3:30 - 7:30)
              </SelectItem>
              <SelectItem value="PM" className="hover:bg-orange-50">
                PM (11:00 - 13:30)
              </SelectItem>
              <SelectItem value="OUROBOROS" className="hover:bg-orange-50">
                OUROBOROS (15:00 - 17:30)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 flex-1">
          <Label
            htmlFor="search"
            className="text-gray-700 font-medium flex items-center gap-2"
          >
            <Search className="h-4 w-4 text-orange-500" />
            Buscar
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-orange-400" />
            <Input
              id="search"
              placeholder="Buscar por cidade ou bairro"
              className="pl-9 rounded-lg border-orange-200 focus:ring-orange-500 focus:border-orange-500 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-shrink-0 self-end">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full border-orange-200 hover:bg-orange-50 hover:text-orange-600"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin text-orange-500" : "text-gray-500"}`}
            />
          </Button>
        </div>
      </div>

      {/* Ações em massa */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-orange-100">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className={`rounded-full shadow-sm transition-all duration-200 ${multiSelectMode ? "bg-orange-100 border-orange-300 text-orange-700" : "border-orange-200 hover:bg-orange-50 hover:text-orange-700"}`}
            onClick={() => {
              setMultiSelectMode(!multiSelectMode);
              if (!multiSelectMode) {
                setSelectedRoutes([]);
              }
            }}
          >
            {multiSelectMode ? "Cancelar Seleção" : "Selecionar Múltiplas"}
          </Button>

          {multiSelectMode && selectedRoutes.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="rounded-full shadow-sm transition-all duration-200 hover:scale-105"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir ({selectedRoutes.length})
            </Button>
          )}

          <Button
            variant={showPendingOnly ? "default" : "outline"}
            size="sm"
            className={`rounded-full shadow-sm transition-all duration-200 ${showPendingOnly ? "bg-amber-500 text-white" : "border-amber-200 text-amber-700 hover:bg-amber-50"}`}
            onClick={() => {
              setShowPendingOnly(!showPendingOnly);
              if (showPendingOnly) {
                // Se estamos desativando o filtro de pendentes, também desativamos o de atribuídas
                setShowAssignedOnly(false);
              }
            }}
          >
            <HourglassIcon className="h-4 w-4 mr-1" />
            {showPendingOnly ? "Mostrando Pendentes" : "Mostrar Pendentes"}
          </Button>

          <Button
            variant={showAssignedOnly ? "default" : "outline"}
            size="sm"
            className={`rounded-full shadow-sm transition-all duration-200 ${showAssignedOnly ? "bg-green-500 text-white" : "border-green-200 text-green-700 hover:bg-green-50"}`}
            onClick={() => {
              setShowAssignedOnly(!showAssignedOnly);
              if (showAssignedOnly) {
                // Se estamos desativando o filtro de atribuídas, também desativamos o de pendentes
                setShowPendingOnly(false);
              }
            }}
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            {showAssignedOnly ? "Mostrando Atribuídas" : "Mostrar Atribuídas"}
          </Button>
        </div>
        <div className="text-sm text-gray-500 italic">
          {filteredRoutes.length} rota(s) encontrada(s)
        </div>
      </div>

      {/* Lista de Rotas */}
      {isLoading ? (
        <div className="flex flex-col justify-center items-center p-12 bg-white rounded-xl shadow-md border border-orange-100">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500 mb-3" />
          <span className="text-orange-700 font-medium">
            Carregando rotas...
          </span>
          <p className="text-gray-500 text-sm mt-2">
            Aguarde enquanto buscamos as informações
          </p>
        </div>
      ) : filteredRoutes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoutes.map((route) => (
            <Card
              key={route.id}
              className={`overflow-hidden hover:shadow-lg transition-all duration-300 rounded-xl h-full ${selectedRoutes.includes(route.id) ? "border-orange-500 bg-orange-50" : route.is_pending ? "border-amber-300 bg-amber-50" : route.isAssigned ? "border-green-300 bg-green-50" : "border-gray-200"}`}
            >
              <CardContent className="p-0">
                <div className="relative">
                  {/* Header with route info */}
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-3 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Package className="h-5 w-5" />
                        <h3 className="font-bold text-lg">
                          Rota {route.fileName.split(" ").pop()}
                        </h3>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          route.shift === "AM"
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : route.shift === "PM"
                              ? "bg-orange-100 text-orange-800 border-orange-200"
                              : "bg-purple-100 text-purple-800 border-purple-200"
                        }
                      >
                        {route.shift}
                      </Badge>
                    </div>
                  </div>

                  {/* Route content */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">{route.city}</span>
                    </div>

                    {/* Toggle neighborhoods */}
                    <div>
                      <button
                        className="text-sm text-orange-600 hover:text-orange-700 flex items-center space-x-1 mb-2"
                        onClick={() =>
                          setShowNeighborhoods({
                            ...showNeighborhoods,
                            [route.id]: !showNeighborhoods[route.id],
                          })
                        }
                      >
                        <Map className="h-3.5 w-3.5" />
                        <span>
                          {showNeighborhoods[route.id]
                            ? "Ocultar bairros"
                            : "Mostrar bairros"}
                        </span>
                      </button>

                      {showNeighborhoods[route.id] && (
                        <div className="bg-orange-50 p-2 rounded-md text-sm">
                          <span className="font-medium text-orange-700">
                            Bairros:
                          </span>
                          <ul className="mt-1 space-y-1 text-gray-700">
                            {route.neighborhoods
                              .slice(0, 3)
                              .map((neighborhood, idx) => (
                                <li key={idx} className="flex items-center">
                                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-2"></span>
                                  {neighborhood}
                                </li>
                              ))}
                            {route.neighborhoods.length > 3 && (
                              <li className="text-gray-500 text-xs italic pl-4">
                                + {route.neighborhoods.length - 3} outros
                                bairros
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center space-x-2 bg-orange-50 p-2 rounded-md">
                        <Truck className="h-4 w-4 text-orange-500" />
                        <div>
                          <span className="font-medium text-orange-700">
                            Distância:
                          </span>{" "}
                          <span>{route.totalDistance.toFixed(1)} km</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 bg-orange-50 p-2 rounded-md">
                        <Package className="h-4 w-4 text-orange-500" />
                        <div>
                          <span className="font-medium text-orange-700">
                            Pacotes:
                          </span>{" "}
                          <span>{route.rawData?.length || 0}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 bg-orange-50 p-2 rounded-md">
                        <Calendar className="h-4 w-4 text-orange-500" />
                        <span>{formatDate(route.date)}</span>
                      </div>
                    </div>

                    {/* Route assignment status */}
                    {route.isAssigned && (
                      <div className="mt-2">
                        <div className="flex items-center space-x-2 bg-green-100 text-green-800 p-2 rounded-md">
                          <CheckCircle className="h-4 w-4" />
                          <span className="font-medium">
                            Rota atribuída a {route.assignedDriver}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Pending driver info */}
                    {route.is_pending && (
                      <div className="mt-2">
                        <div className="flex items-center space-x-2 bg-amber-100 text-amber-800 p-2 rounded-md">
                          <HourglassIcon className="h-4 w-4" />
                          <span className="font-medium">
                            Solicitação pendente
                          </span>
                        </div>

                        <button
                          className="text-sm text-amber-600 hover:text-amber-700 flex items-center space-x-1 mt-2"
                          onClick={() =>
                            setShowDriverInfo({
                              ...showDriverInfo,
                              [route.id]: !showDriverInfo[route.id],
                            })
                          }
                        >
                          <User className="h-3.5 w-3.5" />
                          <span>
                            {showDriverInfo[route.id]
                              ? "Ocultar informações"
                              : "Mostrar informações do motorista"}
                          </span>
                        </button>

                        {showDriverInfo[route.id] && (
                          <div className="mt-2 bg-amber-50 rounded-md overflow-hidden">
                            <PendingDriverInfo routeId={route.id} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                      {multiSelectMode ? (
                        <div className="flex items-center">
                          <Checkbox
                            id={`select-${route.id}`}
                            checked={selectedRoutes.includes(route.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedRoutes([
                                  ...selectedRoutes,
                                  route.id,
                                ]);
                              } else {
                                setSelectedRoutes(
                                  selectedRoutes.filter(
                                    (id) => id !== route.id,
                                  ),
                                );
                              }
                            }}
                            className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                          />
                          <Label
                            htmlFor={`select-${route.id}`}
                            className="ml-2 text-sm text-gray-700"
                          >
                            Selecionar
                          </Label>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full border-orange-200 hover:bg-orange-50 text-orange-700"
                          onClick={() => handleViewRouteDetails(route)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Detalhes
                        </Button>
                      )}

                      {!multiSelectMode && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full border-red-200 hover:bg-red-50 text-red-600"
                          onClick={() => {
                            setDeleteConfirmId(route.id);
                            setShowDeleteConfirm(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Excluir
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col justify-center items-center p-12 bg-white rounded-xl shadow-md border border-orange-100">
          <Package className="h-16 w-16 text-orange-200 mb-4" />
          <h3 className="text-xl font-medium text-gray-700 mb-2">
            Nenhuma rota encontrada
          </h3>
          <p className="text-gray-500 text-center max-w-md">
            Não encontramos nenhuma rota com os filtros selecionados. Tente
            ajustar os filtros ou importar novas rotas.
          </p>
          <Button
            variant="outline"
            className="mt-4 border-orange-200 text-orange-600 hover:bg-orange-50"
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      )}

      {/* Route details dialog */}
      {selectedRoute && (
        <RouteDetails
          route={selectedRoute}
          open={showRouteDetails}
          onOpenChange={setShowRouteDetails}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              {deleteConfirmId
                ? "Tem certeza que deseja excluir esta rota? Esta ação não pode ser desfeita."
                : `Tem certeza que deseja excluir ${selectedRoutes.length} rotas selecionadas? Esta ação não pode ser desfeita.`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500">
              Ao excluir uma rota, todos os dados associados a ela serão
              removidos permanentemente do sistema.
            </p>
            <div className="bg-amber-50 p-3 rounded-md border border-amber-100 mt-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-700">Atenção</p>
                  <p className="text-sm text-amber-600 mt-1">
                    Se houver motoristas que selecionaram esta rota, suas
                    solicitações serão automaticamente canceladas.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeleteConfirmId(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirmId) {
                  // Excluir rota única
                  const routeToDelete = routes.find(
                    (r) => r.id === deleteConfirmId,
                  );
                  if (routeToDelete) {
                    setSelectedRoutes([deleteConfirmId]);
                    handleDeleteMultipleRoutes();
                  }
                } else {
                  // Excluir múltiplas rotas
                  handleDeleteMultipleRoutes();
                }
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvailableRoutes;
