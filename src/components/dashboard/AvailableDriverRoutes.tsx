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
  Info,
  Truck,
  CheckCheck,
  XCircle,
  HourglassIcon,
  Bell,
  Calendar,
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmRouteId, setConfirmRouteId] = useState<string | null>(null);
  const [confirmRouteData, setConfirmRouteData] = useState<RouteData | null>(
    null,
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [userHasSelectedRoute, setUserHasSelectedRoute] = useState(false);
  const [userRouteAssignment, setUserRouteAssignment] = useState<any>(null);
  const [userRouteDetails, setUserRouteDetails] = useState<any>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [userAvailability, setUserAvailability] = useState<string | null>(null);

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

    // Filtrar notificações de teste
    const filteredNotifications = existingNotifications.filter(
      (notification: any) =>
        !notification.title.includes("teste") &&
        !notification.title.includes("Teste") &&
        !notification.message.includes("teste") &&
        !notification.message.includes("Teste"),
    );

    // Adicionar nova notificação no início e limitar a 20
    const updatedNotifications = [
      newNotification,
      ...filteredNotifications.slice(0, 19),
    ];

    // Salvar no localStorage
    localStorage.setItem(
      "adminNotifications",
      JSON.stringify(updatedNotifications),
    );

    // Disparar evento para atualizar outras abas/janelas
    try {
      window.dispatchEvent(
        new CustomEvent("notification-added", {
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

  // Verificar se a rota aprovada deve ser exibida na página inicial
  const shouldShowApprovedRoute = (routeDate: string, shift: string) => {
    try {
      if (!routeDate) return true; // Se não houver data, mostrar por segurança

      const date = parseISO(routeDate);
      if (!isValid(date)) return true; // Se a data for inválida, mostrar por segurança

      const now = new Date();
      const routeDateObj = new Date(date);

      // Definir horários de carregamento baseados no turno
      let loadingTime;
      if (shift === "AM") {
        // Turno da manhã termina às 12:00
        loadingTime = new Date(routeDateObj);
        loadingTime.setHours(12, 0, 0, 0);
      } else if (shift === "PM") {
        // Turno da tarde termina às 18:00
        loadingTime = new Date(routeDateObj);
        loadingTime.setHours(18, 0, 0, 0);
      } else {
        // OUROBOROS ou outros
        // Turno especial termina às 23:59
        loadingTime = new Date(routeDateObj);
        loadingTime.setHours(23, 59, 0, 0);
      }

      // Mostrar a rota se ainda não passou do horário de carregamento
      return now < loadingTime;
    } catch (error) {
      console.error("Erro ao verificar data da rota:", error);
      return true; // Em caso de erro, mostrar por segurança
    }
  };

  // Verificar se o turno já passou e permitir selecionar nova rota
  const checkAndClearExpiredRoute = async () => {
    try {
      if (!userRouteDetails || !userRouteAssignment) return;

      const routeDate = userRouteDetails.date;
      const routeShift = userRouteDetails.shift;

      if (!shouldShowApprovedRoute(routeDate, routeShift)) {
        // O turno já passou, limpar a rota atribuída
        console.log("Turno expirado, limpando rota atribuída");

        const savedUser = localStorage.getItem("authenticatedUser");
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            const userId = userData.userId;

            // Atualizar status da atribuição para 'completed'
            const { error: updateError } = await supabase
              .from("route_assignments")
              .update({ status: "completed" })
              .eq("id", userRouteAssignment.id);

            if (updateError) {
              console.error("Erro ao atualizar status da rota:", updateError);
            } else {
              // Limpar dados locais
              setUserHasSelectedRoute(false);
              setUserRouteAssignment(null);
              setUserRouteDetails(null);

              toast({
                title: "Turno finalizado",
                description:
                  "O turno desta rota já foi finalizado. Você pode selecionar uma nova rota.",
              });
            }
          } catch (parseError) {
            console.error("Erro ao processar dados do usuário:", parseError);
            // Limpar dados locais em caso de erro
            setUserHasSelectedRoute(false);
            setUserRouteAssignment(null);
            setUserRouteDetails(null);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao verificar expiração da rota:", error);
    }
  };

  // Carregar disponibilidade do usuário
  const loadUserAvailability = async () => {
    try {
      // Verificar se há disponibilidade para hoje ou amanhã
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const formattedToday = format(today, "yyyy-MM-dd");
      const formattedTomorrow = format(tomorrow, "yyyy-MM-dd");

      // Primeiro verificar no localStorage para resposta imediata
      const savedAvailability = localStorage.getItem("driverAvailability");
      if (savedAvailability) {
        try {
          const availabilityData = JSON.parse(savedAvailability);
          // Verificar se a data salva é para hoje ou amanhã
          const savedDate = new Date(availabilityData.date);
          const todayDate = new Date(today);
          const tomorrowDate = new Date(tomorrow);

          // Comparar apenas as datas (sem horas)
          if (
            savedDate.toDateString() === todayDate.toDateString() ||
            savedDate.toDateString() === tomorrowDate.toDateString()
          ) {
            setUserAvailability(availabilityData.shift);
          }
        } catch (error) {
          console.error("Erro ao carregar disponibilidade:", error);
        }
      }

      const savedUser = localStorage.getItem("authenticatedUser");
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        const userId = userData.userId;

        // Buscar disponibilidade para hoje ou amanhã no Supabase
        const { data, error } = await supabase
          .from("availability")
          .select("shift, date")
          .eq("user_id", userId)
          .or(`date.eq.${formattedToday},date.eq.${formattedTomorrow}`)
          .order("date", { ascending: true })
          .limit(1);

        if (!error && data && data.length > 0) {
          setUserAvailability(data[0].shift);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar disponibilidade do usuário:", error);
    }
  };

  // Carregar rotas do Supabase
  const fetchRoutes = async () => {
    setIsLoading(true);
    try {
      // Carregar disponibilidade do usuário
      await loadUserAvailability();

      // Verificar se o usuário já tem uma rota selecionada
      const savedUser = localStorage.getItem("authenticatedUser");
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          const userId = userData.userId;

          if (!userId) {
            console.error("ID do usuário não encontrado no localStorage");
            throw new Error("ID do usuário não encontrado");
          }

          // Verificar se o usuário já tem uma rota pendente ou atribuída
          const { data: assignmentData, error: assignmentError } =
            await supabase
              .from("route_assignments")
              .select("*")
              .eq("driver_id", userId)
              .or("status.eq.pending,status.eq.approved,status.eq.rejected")
              .limit(1);

          if (assignmentError) {
            console.error(
              "Erro ao verificar atribuições de rota:",
              assignmentError,
            );
          } else if (assignmentData && assignmentData.length > 0) {
            // Usuário já tem uma rota selecionada
            setUserHasSelectedRoute(true);
            setUserRouteAssignment(assignmentData[0]);

            // Buscar detalhes da rota
            if (assignmentData[0].route_id) {
              const { data: routeData, error: routeError } = await supabase
                .from("routes")
                .select("*")
                .eq("id", assignmentData[0].route_id)
                .single();

              if (!routeError && routeData) {
                setUserRouteDetails({
                  id: routeData.id,
                  fileName: routeData.file_name || "Rota sem nome",
                  city: routeData.city || "Cidade não especificada",
                  neighborhoods: routeData.neighborhoods || [],
                  totalDistance: routeData.total_distance || 0,
                  sequence: routeData.sequence || 0,
                  shift: routeData.shift || "AM",
                  date: routeData.date || new Date().toISOString(),
                  createdAt: routeData.created_at || new Date().toISOString(),
                });
              }
            }
          }
        } catch (parseError) {
          console.error("Erro ao processar dados do usuário:", parseError);
          // Não interromper o carregamento das rotas disponíveis
        }
      }

      // Buscar rotas disponíveis
      const { data: routesData, error: routesError } = await supabase
        .from("routes")
        .select("*")
        .order("created_at", { ascending: false });

      if (routesError) {
        console.error("Erro ao buscar rotas:", routesError);
        toast({
          title: "Erro",
          description: "Não foi possível carregar as rotas disponíveis.",
          variant: "destructive",
        });
      } else if (routesData) {
        const formattedRoutes = routesData.map((route) => ({
          id: route.id,
          fileName: route.file_name || "Rota sem nome",
          city: route.city || "Cidade não especificada",
          neighborhoods: route.neighborhoods || [],
          totalDistance: route.total_distance || 0,
          sequence: route.sequence || 0,
          shift: route.shift || "AM",
          date: route.date || new Date().toISOString(),
          createdAt: route.created_at || new Date().toISOString(),
          assignedDriver: route.assigned_driver,
          isAssigned: !!route.assigned_driver,
        }));

        setRoutes(formattedRoutes);
      }
    } catch (error) {
      console.error("Erro ao carregar rotas:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao carregar as rotas.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Atualizar rotas
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchRoutes();
  };

  // Selecionar rota
  const handleSelectRoute = (route: RouteData) => {
    // Verificar se o usuário já tem uma rota aprovada ou pendente
    if (userHasSelectedRoute) {
      const status = userRouteAssignment?.status;
      if (status === "approved") {
        toast({
          title: "Ação não permitida",
          description:
            "Você já possui uma rota aprovada. Cancele a rota atual antes de selecionar uma nova.",
          variant: "destructive",
        });
        return;
      } else if (status === "pending") {
        toast({
          title: "Solicitação pendente",
          description:
            "Você já possui uma solicitação de rota pendente. Aguarde a aprovação ou cancele a solicitação atual.",
          variant: "destructive",
        });
        return;
      }
    }

    setConfirmRouteId(route.id);
    setConfirmRouteData(route);
    setShowConfirmDialog(true);
  };

  // Confirmar seleção de rota
  const handleConfirmRouteSelection = async () => {
    if (!confirmRouteId || !confirmRouteData) return;

    try {
      const savedUser = localStorage.getItem("authenticatedUser");
      if (!savedUser) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para selecionar uma rota.",
          variant: "destructive",
        });
        return;
      }

      const userData = JSON.parse(savedUser);
      const userId = userData.userId;
      const userName = userData.fullName || "Motorista";

      // Verificar se o usuário já tem uma rota selecionada
      const { data: existingAssignments, error: checkError } = await supabase
        .from("route_assignments")
        .select("*")
        .eq("driver_id", userId)
        .or("status.eq.pending,status.eq.approved")
        .limit(1);

      if (checkError) {
        console.error("Erro ao verificar rotas existentes:", checkError);
        toast({
          title: "Erro",
          description: "Não foi possível verificar suas rotas atuais.",
          variant: "destructive",
        });
        return;
      }

      // Se o usuário já tem uma rota ativa, cancelar a anterior antes de criar uma nova
      if (existingAssignments && existingAssignments.length > 0) {
        const { error: updateError } = await supabase
          .from("route_assignments")
          .update({ status: "cancelled" })
          .eq("id", existingAssignments[0].id);

        if (updateError) {
          console.error("Erro ao cancelar rota anterior:", updateError);
          toast({
            title: "Erro",
            description: "Não foi possível cancelar sua rota anterior.",
            variant: "destructive",
          });
          return;
        }
      }

      // Atualizar a rota como pendente no Supabase
      const { error: routeUpdateError } = await supabase
        .from("routes")
        .update({
          is_pending: true,
          pending_since: new Date().toISOString(),
        })
        .eq("id", confirmRouteId);

      if (routeUpdateError) {
        console.error("Erro ao atualizar status da rota:", routeUpdateError);
      }

      // Criar registro de atribuição de rota
      const { data, error } = await supabase.from("route_assignments").insert([
        {
          driver_id: userId,
          route_id: confirmRouteId,
          status: "pending",
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error("Erro ao selecionar rota:", error);
        toast({
          title: "Erro",
          description: "Não foi possível selecionar esta rota.",
          variant: "destructive",
        });
      } else {
        // Adicionar notificação para o administrador
        addNotification(
          "Nova solicitação de rota",
          `${userName} solicitou a rota ${confirmRouteData.city} (${confirmRouteData.shift}) para aprovação.`,
        );

        // Adicionar notificação para o usuário
        toast({
          title: "Rota Pendente",
          description: `Sua solicitação para a rota ${confirmRouteData.city} está pendente de aprovação.`,
          variant: "default",
        });

        toast({
          title: "Sucesso",
          description: "Rota selecionada com sucesso! Aguardando aprovação.",
        });
        setUserHasSelectedRoute(true);
        setUserRouteDetails(confirmRouteData);
        // Recarregar rotas
        fetchRoutes();
      }
    } catch (error) {
      console.error("Erro ao processar seleção de rota:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive",
      });
    } finally {
      setShowConfirmDialog(false);
      setConfirmRouteId(null);
      setConfirmRouteData(null);
    }
  };

  // Cancelar seleção de rota
  const handleCancelRouteSelection = () => {
    setShowConfirmDialog(false);
    setConfirmRouteId(null);
    setConfirmRouteData(null);
  };

  // Visualizar status da rota selecionada
  const handleViewRouteStatus = () => {
    setShowStatusDialog(true);
  };

  // Fechar diálogo de status
  const handleCloseStatusDialog = () => {
    setShowStatusDialog(false);
  };

  // Cancelar rota selecionada
  const handleCancelSelectedRoute = async () => {
    try {
      if (!userRouteAssignment) return;

      const { error } = await supabase
        .from("route_assignments")
        .update({ status: "cancelled" })
        .eq("id", userRouteAssignment.id);

      if (error) {
        console.error("Erro ao cancelar rota:", error);
        toast({
          title: "Erro",
          description: "Não foi possível cancelar esta rota.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sucesso",
          description: "Rota cancelada com sucesso!",
        });
        setUserHasSelectedRoute(false);
        setUserRouteAssignment(null);
        setUserRouteDetails(null);
        // Recarregar rotas
        fetchRoutes();
      }
    } catch (error) {
      console.error("Erro ao processar cancelamento de rota:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive",
      });
    } finally {
      setShowStatusDialog(false);
    }
  };

  // Formatar data
  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return "Data não disponível";
      const date = parseISO(dateString);
      if (!isValid(date)) return "Data inválida";
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch (error) {
      console.error("Erro ao formatar data:", error);
      return "Data inválida";
    }
  };

  // Filtrar rotas com base na disponibilidade do usuário
  // Nota: Esta função foi substituída por displayedRoutes que também considera se o usuário já tem uma rota aprovada
  const filteredRoutes = React.useMemo(() => {
    if (!userAvailability) return routes;
    return routes.filter((route) => route.shift === userAvailability);
  }, [routes, userAvailability]);

  // Verificar se o usuário já tem uma rota selecionada
  useEffect(() => {
    fetchRoutes();

    // Verificar se a rota atual expirou
    checkAndClearExpiredRoute();

    // Verificar se há mudanças no status da rota e notificar o usuário
    const checkRouteStatusChanges = async () => {
      if (userRouteAssignment && userRouteDetails) {
        const { data, error } = await supabase
          .from("route_assignments")
          .select("*")
          .eq("id", userRouteAssignment.id)
          .single();

        if (!error && data) {
          // Se o status mudou desde a última verificação
          if (data.status !== userRouteAssignment.status) {
            const oldStatus = userRouteAssignment.status;
            const newStatus = data.status;

            // Atualizar o estado local
            setUserRouteAssignment(data);

            // Notificar o usuário sobre a mudança de status
            if (newStatus === "approved" && oldStatus === "pending") {
              // Mostrar os 3 bairros com mais pacotes (simulado aqui)
              const topNeighborhoods = userRouteDetails.neighborhoods
                .slice(0, 3)
                .join(", ");

              toast({
                title: "Rota Aprovada",
                description: `Sua rota para ${userRouteDetails.city} foi aprovada! Distância total: ${userRouteDetails.totalDistance.toFixed(1)}km. Principais bairros: ${topNeighborhoods}`,
                variant: "default",
              });
            } else if (newStatus === "rejected" && oldStatus === "pending") {
              toast({
                title: "Rota Recusada",
                description: `Sua solicitação para a rota ${userRouteDetails.city} foi recusada.`,
                variant: "destructive",
              });
            }
          }
        }
      }
    };

    // Verificar imediatamente e depois periodicamente
    checkRouteStatusChanges();

    // Configurar intervalo para verificar periodicamente
    const interval = setInterval(() => {
      fetchRoutes();
      checkAndClearExpiredRoute();
      checkRouteStatusChanges();
    }, 60000); // Verificar a cada minuto

    return () => clearInterval(interval);
  }, []);

  // Filtrar rotas com base na disponibilidade do usuário e se o usuário já tem uma rota aprovada ou pendente
  const displayedRoutes = React.useMemo(() => {
    // Se o usuário já tem uma rota aprovada ou pendente, não mostrar outras rotas
    if (
      userHasSelectedRoute &&
      (userRouteAssignment?.status === "approved" ||
        userRouteAssignment?.status === "pending")
    ) {
      return [];
    }

    // Caso contrário, mostrar rotas filtradas por disponibilidade
    if (!userAvailability) return routes;
    return routes.filter((route) => route.shift === userAvailability);
  }, [routes, userAvailability, userHasSelectedRoute, userRouteAssignment]);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between bg-gradient-to-r from-orange-500 to-orange-700 p-4 rounded-lg shadow-md mb-4">
        <h2 className="text-2xl font-bold text-white flex items-center">
          <Package className="h-6 w-6 mr-2" />
          Rotas Disponíveis
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="bg-white hover:bg-orange-50 text-orange-700 border-white hover:border-orange-100"
        >
          {isRefreshing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Atualizar</span>
        </Button>
      </div>

      {userHasSelectedRoute && (
        <Card className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 border-orange-200 dark:border-orange-800 shadow-md mb-6">
          <CardContent className="p-0">
            <div className="border-l-4 border-orange-500 dark:border-orange-600 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="bg-orange-100 dark:bg-orange-900 p-2 rounded-full">
                    <CheckCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-orange-800 dark:text-orange-300 text-lg">
                      Você já selecionou uma rota
                    </h3>
                    {userRouteDetails && (
                      <div className="mt-1 space-y-1">
                        <p className="text-sm flex items-center text-orange-700 dark:text-orange-400">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span className="font-medium">
                            {userRouteDetails.city}
                          </span>
                        </p>
                        <p className="text-sm text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50 px-2 py-1 rounded">
                          <span className="font-medium">Bairros:</span>{" "}
                          <ul className="mt-1 space-y-1">
                            {userRouteDetails.neighborhoods
                              .slice(0, 3)
                              .map((neighborhood, idx) => (
                                <li key={idx} className="flex items-start">
                                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-2 mt-1.5"></span>
                                  <span>{neighborhood}</span>
                                </li>
                              ))}
                          </ul>
                        </p>
                        <p className="text-sm flex items-center text-orange-700 dark:text-orange-400">
                          <Clock className="h-4 w-4 mr-1" />
                          <span className="font-medium">Turno:</span>{" "}
                          <Badge className="ml-1 bg-orange-200 text-orange-800 border-orange-300 hover:bg-orange-200">
                            {userRouteDetails.shift}
                          </Badge>
                        </p>
                      </div>
                    )}
                    <div className="mt-2 flex items-center">
                      <Bell className="h-4 w-4 mr-1 text-orange-600 dark:text-orange-400" />
                      <span className="text-sm font-medium mr-1">Status:</span>
                      {userRouteAssignment?.status === "pending" ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium text-sm bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded">
                          Aguardando aprovação
                        </span>
                      ) : userRouteAssignment?.status === "approved" ? (
                        <span className="text-orange-600 dark:text-orange-400 font-medium text-sm bg-orange-100 dark:bg-orange-900/50 px-2 py-0.5 rounded">
                          Aprovada
                        </span>
                      ) : userRouteAssignment?.status === "rejected" ? (
                        <span className="text-red-600 dark:text-red-400 font-medium text-sm bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded">
                          Recusada
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 font-medium text-sm bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded">
                          Cancelada
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewRouteStatus}
                  className="bg-white dark:bg-orange-900 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-800"
                >
                  <Info className="h-4 w-4 mr-2" />
                  Detalhes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center space-y-3 bg-orange-50 dark:bg-orange-950/30 p-6 rounded-lg shadow-inner">
            <div className="relative">
              <RefreshCw className="h-10 w-10 animate-spin text-orange-600 dark:text-orange-400" />
              <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-orange-200 dark:border-orange-800 border-dashed animate-ping"></div>
            </div>
            <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
              Carregando rotas...
            </p>
          </div>
        </div>
      ) : userHasSelectedRoute && userRouteAssignment?.status === "approved" ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center space-y-3 bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle className="h-12 w-12 text-green-500 dark:text-green-400" />
            <div className="text-center">
              <p className="font-medium text-green-800 dark:text-green-300">
                Você já possui uma rota aprovada
              </p>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                Você não pode selecionar outras rotas enquanto tiver uma rota
                ativa
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewRouteStatus}
              className="mt-2 border-green-300 text-green-700 hover:bg-green-100"
            >
              <Info className="h-4 w-4 mr-2" />
              Ver Detalhes da Rota
            </Button>
          </div>
        </div>
      ) : !userAvailability ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center space-y-3 bg-amber-50 dark:bg-amber-900/20 p-6 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-12 w-12 text-amber-500 dark:text-amber-400" />
            <div className="text-center">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Você precisa definir sua disponibilidade
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Defina sua disponibilidade na aba Agenda para ver rotas
                disponíveis para hoje ou amanhã
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="mt-2 border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      ) : displayedRoutes.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center space-y-3 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
            <Package className="h-12 w-12 text-gray-400 dark:text-gray-600" />
            <div className="text-center">
              <p className="font-medium text-gray-700 dark:text-gray-300">
                Nenhuma rota disponível para seu turno de disponibilidade
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Verifique novamente mais tarde ou entre em contato com o
                administrador
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedRoutes.map((route) => (
            <Card
              key={route.id}
              className={
                route.isAssigned
                  ? "border-gray-300 bg-gray-50 dark:bg-gray-900 dark:border-gray-700"
                  : "bg-gradient-to-br from-white to-orange-50 dark:from-gray-800 dark:to-gray-900 border-orange-100 dark:border-orange-900 shadow-md hover:shadow-lg transition-all duration-200"
              }
            >
              <CardContent className="p-0">
                <div className="relative overflow-hidden">
                  {/* Header with route number and shift badge */}
                  <div className="bg-gradient-to-r from-orange-500 to-amber-600 dark:from-orange-700 dark:to-amber-800 p-3 text-white">
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
                            ? "bg-amber-400 text-amber-900 border-amber-500 hover:bg-amber-400"
                            : route.shift === "PM"
                              ? "bg-indigo-400 text-indigo-900 border-indigo-500 hover:bg-indigo-400"
                              : "bg-emerald-400 text-emerald-900 border-emerald-500 hover:bg-emerald-400"
                        }
                      >
                        {route.shift}
                      </Badge>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-4">
                    <div className="flex items-center space-x-2 text-orange-700 dark:text-orange-400">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium truncate">{route.city}</span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm bg-orange-50 dark:bg-gray-800 p-2 rounded-md max-h-32 overflow-y-auto">
                        <span className="font-medium text-orange-700 dark:text-orange-400">
                          Bairros:
                        </span>
                        <ul className="mt-1 space-y-1">
                          {route.neighborhoods
                            .slice(0, 3)
                            .map((neighborhood, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-2 mt-1.5"></span>
                                <span className="text-gray-700 dark:text-gray-300">
                                  {neighborhood}
                                </span>
                              </li>
                            ))}
                          {route.neighborhoods.length > 3 && (
                            <li className="text-gray-500 dark:text-gray-400 text-xs italic pl-4">
                              + {route.neighborhoods.length - 3} outros bairros
                            </li>
                          )}
                        </ul>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center space-x-2 bg-orange-50 dark:bg-gray-800/50 p-2 rounded-md">
                          <Truck className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {route.totalDistance.toFixed(1)} km
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 bg-orange-50 dark:bg-gray-800/50 p-2 rounded-md">
                          <Calendar className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {formatDate(route.date)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {route.isAssigned ? (
                      <div className="mt-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-md">
                        <div className="flex items-center space-x-2">
                          <CheckCheck className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Rota já atribuída
                          </span>
                        </div>
                      </div>
                    ) : (
                      <Button
                        className="w-full mt-2 bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => handleSelectRoute(route)}
                        disabled={
                          userHasSelectedRoute &&
                          userRouteAssignment?.status === "approved"
                        }
                      >
                        Selecionar Rota
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo de confirmação */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Seleção de Rota</DialogTitle>
            <DialogDescription>
              Você está selecionando a seguinte rota:
            </DialogDescription>
          </DialogHeader>
          {confirmRouteData && (
            <div className="py-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5 text-orange-500" />
                    <span className="font-medium">{confirmRouteData.city}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      confirmRouteData.shift === "AM"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : confirmRouteData.shift === "PM"
                          ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300"
                    }
                  >
                    {confirmRouteData.shift}
                  </Badge>
                </div>

                <div className="bg-orange-50 p-3 rounded-md">
                  <p className="text-sm font-medium text-orange-700 mb-2">
                    Detalhes da Rota:
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center">
                      <Truck className="h-4 w-4 text-orange-500 mr-2" />
                      <span>
                        Distância: {confirmRouteData.totalDistance.toFixed(1)}{" "}
                        km
                      </span>
                    </li>
                    <li className="flex items-center">
                      <Calendar className="h-4 w-4 text-orange-500 mr-2" />
                      <span>Data: {formatDate(confirmRouteData.date)}</span>
                    </li>
                    <li className="flex items-start">
                      <MapPin className="h-4 w-4 text-orange-500 mr-2 mt-1" />
                      <div>
                        <span>Bairros principais: </span>
                        <span className="font-medium">
                          {confirmRouteData.neighborhoods
                            .slice(0, 3)
                            .join(", ")}
                          {confirmRouteData.neighborhoods.length > 3 &&
                            ` e mais ${confirmRouteData.neighborhoods.length - 3} outros`}
                        </span>
                      </div>
                    </li>
                  </ul>
                </div>

                <p className="text-sm text-gray-500">
                  Ao confirmar, você estará solicitando esta rota. Um
                  administrador precisará aprovar sua solicitação.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelRouteSelection}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmRouteSelection}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Seleção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de status da rota */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Rota Selecionada</DialogTitle>
            <DialogDescription>
              Informações sobre a rota que você selecionou.
            </DialogDescription>
          </DialogHeader>
          {userRouteDetails && (
            <div className="py-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5 text-orange-500" />
                    <span className="font-medium text-lg">
                      {userRouteDetails.city}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      userRouteDetails.shift === "AM"
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : userRouteDetails.shift === "PM"
                          ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300"
                    }
                  >
                    {userRouteDetails.shift}
                  </Badge>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-md space-y-3">
                  <div>
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">
                      Status da Solicitação:
                    </p>
                    <div className="flex items-center">
                      {userRouteAssignment?.status === "pending" ? (
                        <>
                          <HourglassIcon className="h-5 w-5 text-amber-500 mr-2" />
                          <span className="text-amber-600 font-medium">
                            Aguardando aprovação
                          </span>
                        </>
                      ) : userRouteAssignment?.status === "approved" ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                          <span className="text-green-600 font-medium">
                            Aprovada
                          </span>
                        </>
                      ) : userRouteAssignment?.status === "rejected" ? (
                        <>
                          <XCircle className="h-5 w-5 text-red-500 mr-2" />
                          <span className="text-red-600 font-medium">
                            Recusada
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-gray-500 mr-2" />
                          <span className="text-gray-600 font-medium">
                            Cancelada
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">
                      Detalhes da Rota:
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center">
                        <Truck className="h-4 w-4 text-orange-500 dark:text-orange-400 mr-2" />
                        <span className="text-gray-700 dark:text-gray-300">
                          Distância: {userRouteDetails.totalDistance.toFixed(1)}{" "}
                          km
                        </span>
                      </li>
                      <li className="flex items-center">
                        <Calendar className="h-4 w-4 text-orange-500 dark:text-orange-400 mr-2" />
                        <span className="text-gray-700 dark:text-gray-300">
                          Data: {formatDate(userRouteDetails.date)}
                        </span>
                      </li>
                      <li className="flex items-start">
                        <MapPin className="h-4 w-4 text-orange-500 dark:text-orange-400 mr-2 mt-1" />
                        <div className="text-gray-700 dark:text-gray-300">
                          <span>Bairros principais: </span>
                          <span className="font-medium">
                            {userRouteDetails.neighborhoods
                              .slice(0, 3)
                              .join(", ")}
                            {userRouteDetails.neighborhoods.length > 3 &&
                              ` e mais ${userRouteDetails.neighborhoods.length - 3} outros`}
                          </span>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>

                {userRouteAssignment?.status === "pending" && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
                    <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Sua solicitação está pendente de aprovação. Um
                      administrador irá analisar e aprovar ou recusar em breve.
                    </p>
                  </div>
                )}

                {userRouteAssignment?.status === "approved" && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                    <p className="text-sm text-green-700 dark:text-green-400 flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Sua rota foi aprovada! Você pode iniciar as entregas
                      conforme programado.
                    </p>
                  </div>
                )}

                {userRouteAssignment?.status === "rejected" && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                    <p className="text-sm text-red-700 dark:text-red-400 flex items-center">
                      <XCircle className="h-4 w-4 mr-2" />
                      Sua solicitação foi recusada. Por favor, selecione outra
                      rota ou entre em contato com o administrador.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseStatusDialog}
            >
              Fechar
            </Button>
            {userRouteAssignment?.status !== "cancelled" && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancelSelectedRoute}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar Rota
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvailableDriverRoutes;
