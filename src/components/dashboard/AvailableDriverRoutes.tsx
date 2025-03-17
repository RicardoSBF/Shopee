import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";
import {
  MapPin,
  Package,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Map,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

const AvailableDriverRoutes = () => {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [filteredRoutes, setFilteredRoutes] = useState<RouteData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmRouteId, setConfirmRouteId] = useState<string | null>(null);
  const [confirmRouteData, setConfirmRouteData] = useState<RouteData | null>(
    null,
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Carregar rotas do Supabase e localStorage com otimização de performance
  const fetchRoutes = async () => {
    setIsLoading(true);
    try {
      // Obter a região principal do usuário
      const primaryRegion = localStorage.getItem("primaryRegion");
      // Obter regiões de backup do usuário
      const backupRegionsStr = localStorage.getItem("backupRegions");
      const backupRegions = backupRegionsStr
        ? JSON.parse(backupRegionsStr)
        : [];

      if (!primaryRegion && (!backupRegions || backupRegions.length === 0)) {
        console.log("Regiões não configuradas");
        setRoutes([]);
        setFilteredRoutes([]);
        setIsLoading(false);
        return;
      }

      // Criar array com todas as regiões do usuário
      const userRegions = [primaryRegion, ...backupRegions].filter(Boolean);
      console.log("Regiões do usuário:", userRegions);

      // Buscar rotas do Supabase que correspondam às regiões do usuário
      const { data, error } = await supabase
        .from("routes")
        .select("*")
        .eq("is_assigned", false) // Apenas rotas não atribuídas
        .eq("is_pending", false) // Apenas rotas não pendentes
        .in("city", userRegions) // Rotas das regiões do usuário
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar rotas do Supabase:", error);
        setRoutes([]);
        setFilteredRoutes([]);
      } else if (data && data.length > 0) {
        console.log("Rotas carregadas do Supabase:", data.length);
        // Transformar dados do Supabase para o formato RouteData
        const formattedRoutes: RouteData[] = data.map((route) => ({
          id: route.id,
          fileName: route.file_name,
          city: route.city,
          neighborhoods: route.neighborhoods || [],
          totalDistance: route.total_distance || 0,
          sequence:
            route.raw_data && route.raw_data.length > 1
              ? route.raw_data.length - 1
              : 0,
          shift: route.shift,
          date: route.date,
          createdAt: route.created_at,
          rawData: route.raw_data || [],
          isAssigned: false,
        }));

        setRoutes(formattedRoutes);
        setFilteredRoutes(formattedRoutes);
      } else {
        console.log("Nenhuma rota encontrada no Supabase");
        setRoutes([]);
        setFilteredRoutes([]);
      }
    } catch (error) {
      console.error("Erro geral ao buscar rotas:", error);
      setRoutes([]);
      setFilteredRoutes([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Efeito para carregar rotas apenas ao montar o componente
  useEffect(() => {
    fetchRoutes();
    // Não configurar nenhum refresh automático - apenas manual via botão
  }, []);

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

  // Função para atualizar manualmente as rotas
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchRoutes();
  };

  // Função para selecionar uma rota
  const handleSelectRoute = (route: RouteData) => {
    setConfirmRouteId(route.id);
    setConfirmRouteData(route);
    setShowConfirmDialog(true);
  };

  // Função para confirmar a seleção da rota
  const confirmRouteSelection = async () => {
    if (!confirmRouteId || !confirmRouteData) return;

    try {
      setIsLoading(true);

      // Obter dados do usuário
      const savedUser = localStorage.getItem("authenticatedUser");
      if (!savedUser) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      const userData = JSON.parse(savedUser);
      const userId = userData.userId;
      const userName = localStorage.getItem("profileData")
        ? JSON.parse(localStorage.getItem("profileData") || "{}").fullName
        : "Motorista";

      // Criar uma entrada na tabela route_assignments
      const { data: assignmentData, error: assignmentError } = await supabase
        .from("route_assignments")
        .insert({
          route_id: confirmRouteId,
          driver_id: userId,
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select();

      if (assignmentError) throw assignmentError;

      // Atualizar rota no banco de dados como pendente
      const { error } = await supabase
        .from("routes")
        .update({
          is_pending: true,
          pending_since: new Date().toISOString(),
        })
        .eq("id", confirmRouteId);

      if (error) throw error;

      // Adicionar notificação para o usuário
      const notificationTitle = "Rota selecionada";
      const notificationMessage = `Você selecionou uma rota em ${confirmRouteData.city}. Turno de carregamento: ${formatShift(confirmRouteData.shift)}. Status: Pendente de aprovação.`;

      // Obter notificações existentes
      const savedNotifications = localStorage.getItem("userNotifications");
      const existingNotifications = savedNotifications
        ? JSON.parse(savedNotifications)
        : [];

      // Adicionar nova notificação
      const newNotification = {
        id: Date.now().toString(),
        title: notificationTitle,
        message: notificationMessage,
        time: new Date().toISOString(),
        read: false,
      };

      const updatedNotifications = [
        newNotification,
        ...existingNotifications.slice(0, 19),
      ];

      // Salvar no localStorage
      localStorage.setItem(
        "userNotifications",
        JSON.stringify(updatedNotifications),
      );

      // Mostrar notificação
      toast({
        title: "Rota selecionada",
        description: `Você selecionou uma rota em ${confirmRouteData.city}. Status: Pendente de aprovação.`,
        variant: "default",
      });

      // Fechar diálogo e atualizar rotas
      setShowConfirmDialog(false);
      setConfirmRouteId(null);
      setConfirmRouteData(null);
      fetchRoutes();
    } catch (error) {
      console.error("Erro ao selecionar rota:", error);
      toast({
        title: "Erro ao selecionar rota",
        description: "Não foi possível selecionar a rota. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Apenas botão de atualização */}
      <div className="flex justify-end bg-white p-5 rounded-xl shadow-md border border-orange-100">
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

      {/* Informações */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-orange-100">
        <div className="text-sm text-gray-500 italic">
          {filteredRoutes.length} rota(s) disponível(is) na sua região principal
        </div>
      </div>

      {/* Lista de Rotas */}
      {isLoading ? (
        <div className="flex flex-col justify-center items-center p-12 bg-white rounded-xl shadow-md border border-orange-100">
          <RefreshCw className="h-10 w-10 animate-spin text-orange-500 mb-3" />
          <span className="text-orange-700 font-medium">
            Carregando rotas...
          </span>
          <p className="text-gray-500 text-sm mt-2">
            Aguarde enquanto buscamos as informações
          </p>
        </div>
      ) : filteredRoutes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-white p-6 rounded-xl shadow-md border border-orange-100">
          {filteredRoutes.map((route) => (
            <Card
              key={route.id}
              className="overflow-hidden hover:shadow-lg transition-all duration-300 rounded-xl h-full border-orange-200"
            >
              <CardContent className="p-0 h-full flex flex-col">
                <div className="p-4 bg-gradient-to-r from-orange-100 to-orange-50/50 border-b border-orange-200">
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
                          {route.rawData && route.rawData.length > 1
                            ? route.rawData.length - 1
                            : route.sequence}{" "}
                          pacotes
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end items-center mt-4 pt-3 border-t border-gray-100">
                    <Button
                      className="rounded-full bg-orange-500 hover:bg-orange-600 text-white transition-all duration-200 shadow-sm"
                      onClick={() => handleSelectRoute(route)}
                    >
                      Selecionar Rota
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center p-10 bg-white rounded-xl border border-orange-100 shadow-md">
          <Map className="h-16 w-16 text-orange-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-orange-700 mb-2">
            Nenhuma rota disponível
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Não foram encontradas rotas disponíveis para sua região principal.
            Verifique novamente mais tarde.
          </p>
          <Button
            variant="outline"
            className="rounded-full border-orange-200 bg-white hover:bg-orange-50 text-orange-700 shadow-sm transition-all duration-200 hover:scale-105"
            onClick={fetchRoutes}
          >
            Atualizar rotas
          </Button>
        </div>
      )}

      {/* Diálogo de confirmação */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-orange-500" />
              Confirmar seleção de rota
            </DialogTitle>
            <DialogDescription>
              Você está prestes a selecionar uma rota. Esta ação precisará ser
              aprovada por um administrador.
            </DialogDescription>
          </DialogHeader>

          {confirmRouteData && (
            <div className="py-4 space-y-4">
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-800">
                    {confirmRouteData.city}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span className="text-orange-800">
                    {formatShift(confirmRouteData.shift)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-orange-600" />
                  <span className="text-orange-800">
                    {confirmRouteData.rawData &&
                    confirmRouteData.rawData.length > 1
                      ? confirmRouteData.rawData.length - 1
                      : confirmRouteData.sequence}{" "}
                    pacotes
                  </span>
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <div className="text-sm text-amber-700">
                    Ao confirmar, você estará se candidatando para esta rota. Um
                    administrador precisará aprovar sua solicitação.
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmDialog(false);
                setConfirmRouteId(null);
                setConfirmRouteData(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={confirmRouteSelection}
              disabled={isLoading}
            >
              {isLoading ? "Processando..." : "Confirmar Seleção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvailableDriverRoutes;
