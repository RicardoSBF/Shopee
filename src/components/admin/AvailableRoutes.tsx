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
} from "lucide-react";
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
}

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
        .select("*")
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
  }, [selectedShift, selectedDate, searchTerm, routes]);

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
        <div className="flex gap-2">
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
              className={`overflow-hidden hover:shadow-lg transition-all duration-300 rounded-xl h-full ${selectedRoutes.includes(route.id) ? "border-blue-300 bg-blue-50/70" : route.isAssigned ? "border-green-300 bg-green-50/70" : "border-orange-200"}`}
            >
              <CardContent className="p-0 h-full flex flex-col">
                <div
                  className={`p-4 ${route.isAssigned ? "bg-gradient-to-r from-green-100 to-green-50/50 border-b border-green-200" : "bg-gradient-to-r from-orange-100 to-orange-50/50 border-b border-orange-200"}`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge
                      variant="outline"
                      className={`shadow-sm ${getShiftBadgeClass(route.shift)} rounded-full px-2 py-0.5 text-xs`}
                    >
                      {formatShift(route.shift)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-xs font-medium bg-white/80 backdrop-blur-sm shadow-sm px-2 py-0.5 rounded-full"
                    >
                      {formatDate(route.date)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    <h3 className="text-lg font-bold text-orange-700 truncate">
                      {route.city}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3 max-h-16 overflow-y-auto">
                    {route.neighborhoods
                      .slice(0, 3)
                      .map((neighborhood, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="bg-white/80 backdrop-blur-sm shadow-sm rounded-full px-2 py-0.5 text-xs text-gray-700"
                        >
                          {neighborhood}
                        </Badge>
                      ))}
                    {route.neighborhoods.length > 3 && (
                      <Badge
                        variant="outline"
                        className="bg-orange-50 text-orange-600 rounded-full px-2 py-0.5 text-xs"
                      >
                        +{route.neighborhoods.length - 3} mais
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full shadow-sm">
                        <Package className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium">
                          {route.sequence} pacotes
                        </span>
                      </div>

                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full shadow-sm">
                        <Route className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium">
                          {typeof route.totalDistance === "string"
                            ? route.totalDistance
                            : `${route.totalDistance.toFixed(1)} km`}
                        </span>
                      </div>
                    </div>

                    {route.isAssigned && (
                      <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Truck className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-700">
                            Motorista Atribuído
                          </span>
                        </div>
                        <div className="text-sm text-green-700 pl-6">
                          {route.assignedDriver}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
                    {multiSelectMode ? (
                      <Checkbox
                        checked={selectedRoutes.includes(route.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRoutes((prev) => [...prev, route.id]);
                          } else {
                            setSelectedRoutes((prev) =>
                              prev.filter((id) => id !== route.id),
                            );
                          }
                        }}
                        className="h-5 w-5 border-orange-300 text-orange-500"
                      />
                    ) : (
                      <div className="text-xs text-gray-500">
                        ID: {route.id.substring(0, 8)}...
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full border-orange-200 hover:bg-orange-50 hover:text-orange-700 transition-all duration-200 shadow-sm"
                        onClick={() => handleViewRouteDetails(route)}
                      >
                        <Eye className="h-4 w-4 mr-1 text-orange-500" />
                        Detalhes
                      </Button>

                      {!multiSelectMode && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50 rounded-full shadow-sm transition-all duration-200"
                          onClick={() => setDeleteConfirmId(route.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Confirmação de exclusão */}
                  {deleteConfirmId === route.id && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center p-4 rounded-xl z-10">
                      <div className="bg-white p-4 rounded-lg border border-red-100 shadow-lg max-w-xs w-full">
                        <div className="flex items-center gap-2 mb-3 text-red-600">
                          <AlertTriangle className="h-5 w-5" />
                          <span className="font-medium">
                            Confirmar exclusão
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                          Tem certeza que deseja excluir esta rota? Esta ação
                          não pode ser desfeita.
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full shadow-sm"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Cancelar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="rounded-full shadow-sm"
                            onClick={async () => {
                              try {
                                setIsLoading(true);
                                // Excluir a rota do Supabase
                                const { error } = await supabase
                                  .from("routes")
                                  .delete()
                                  .eq("id", route.id);

                                // Verificar se a exclusão foi bem-sucedida
                                if (error) {
                                  console.error(
                                    `Erro ao excluir rota ${route.id}:`,
                                    error,
                                  );
                                  throw error;
                                }

                                // Remover também do localStorage se existir
                                const savedRoutes =
                                  localStorage.getItem("importedRoutes");
                                if (savedRoutes) {
                                  const parsedRoutes = JSON.parse(savedRoutes);
                                  const updatedRoutes = parsedRoutes.filter(
                                    (r: any) => r.id !== route.id,
                                  );
                                  localStorage.setItem(
                                    "importedRoutes",
                                    JSON.stringify(updatedRoutes),
                                  );
                                }

                                // Atualizar a lista de rotas após exclusão
                                setRoutes((prev) =>
                                  prev.filter((r) => r.id !== route.id),
                                );
                                setFilteredRoutes((prev) =>
                                  prev.filter((r) => r.id !== route.id),
                                );
                                setDeleteConfirmId(null);

                                // Adicionar notificação para a rota excluída
                                const notificationTitle = "Rota excluída";
                                const notificationMessage = `A rota ${route.city} (${route.fileName}) foi excluída com sucesso.`;
                                addNotification(
                                  notificationTitle,
                                  notificationMessage,
                                );

                                // Mostrar notificação de sucesso
                                toast({
                                  title: "Rota excluída",
                                  description: `A rota ${route.city} foi excluída com sucesso.`,
                                  variant: "default",
                                });

                                // Forçar uma atualização imediata
                                setTimeout(() => {
                                  fetchRoutes();
                                }, 500);
                              } catch (error) {
                                console.error("Erro ao excluir rota:", error);
                                toast({
                                  title: "Erro ao excluir",
                                  description:
                                    "Não foi possível excluir a rota. Tente novamente.",
                                  variant: "destructive",
                                });
                              } finally {
                                setIsLoading(false);
                              }
                            }}
                          >
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-10 bg-gradient-to-b from-orange-50 to-white rounded-xl border border-orange-100 shadow-sm">
          <Map className="h-16 w-16 text-orange-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-orange-700 mb-2">
            Nenhuma rota encontrada
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Não foram encontradas rotas com os filtros selecionados. Tente
            ajustar os critérios de busca ou importar novas rotas.
          </p>
          <Button
            variant="outline"
            className="rounded-full border-orange-200 bg-white hover:bg-orange-50 text-orange-700 shadow-sm transition-all duration-200 hover:scale-105"
            onClick={() => {
              setSelectedShift("ALL");
              setSearchTerm("");
              fetchRoutes();
            }}
          >
            Limpar filtros
          </Button>
        </div>
      )}

      {/* Diálogo de confirmação de exclusão em massa */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-xl max-w-md w-full border border-red-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center mb-4 text-red-600">
              <AlertTriangle className="h-6 w-6 mr-2" />
              <h3 className="text-xl font-bold">Confirmar exclusão</h3>
            </div>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              Tem certeza que deseja excluir{" "}
              <span className="font-bold text-red-600">
                {selectedRoutes.length}
              </span>{" "}
              rota(s)? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                className="rounded-full border-gray-200"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="rounded-full shadow-sm"
                onClick={handleDeleteMultipleRoutes}
              >
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de Detalhes da Rota */}
      {selectedRoute && (
        <RouteDetails
          isOpen={showRouteDetails}
          onClose={() => setShowRouteDetails(false)}
          routeData={selectedRoute}
        />
      )}
    </div>
  );
};

export default AvailableRoutes;
