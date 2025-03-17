import React, { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Check,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  Route,
  Truck,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Carregar notificações do localStorage
  const loadNotifications = () => {
    const savedNotifications = localStorage.getItem("adminNotifications");
    if (savedNotifications) {
      try {
        const parsedNotifications = JSON.parse(savedNotifications);
        if (Array.isArray(parsedNotifications)) {
          setNotifications(parsedNotifications);
          setUnreadCount(
            parsedNotifications.filter((n: Notification) => !n.read).length,
          );
        } else {
          // Se não for um array, resetar as notificações
          setNotifications([]);
          setUnreadCount(0);
          localStorage.setItem("adminNotifications", JSON.stringify([]));
        }
      } catch (error) {
        // Em caso de erro, limpar as notificações
        setNotifications([]);
        setUnreadCount(0);
        localStorage.setItem("adminNotifications", JSON.stringify([]));
      }
    }
  };

  // Carregar notificações inicialmente
  useEffect(() => {
    loadNotifications();

    // Adicionar listener para atualizações de outras abas/janelas
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "adminNotifications") {
        loadNotifications();
      }
    };

    // Adicionar listener para evento customizado
    const handleNotificationAdded = () => {
      loadNotifications();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("notification-added", handleNotificationAdded);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("notification-added", handleNotificationAdded);
    };
  }, []);

  // Marcar todas as notificações como lidas
  const markAllAsRead = () => {
    const updatedNotifications = notifications.map((notification) => ({
      ...notification,
      read: true,
    }));
    setNotifications(updatedNotifications);
    setUnreadCount(0);
    localStorage.setItem(
      "adminNotifications",
      JSON.stringify(updatedNotifications),
    );
  };

  // Limpar todas as notificações
  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    localStorage.setItem("adminNotifications", JSON.stringify([]));
  };

  // Marcar uma notificação específica como lida
  const markAsRead = (id: string) => {
    const updatedNotifications = notifications.map((notification) =>
      notification.id === id ? { ...notification, read: true } : notification,
    );
    setNotifications(updatedNotifications);
    setUnreadCount(
      updatedNotifications.filter((notification) => !notification.read).length,
    );
    localStorage.setItem(
      "adminNotifications",
      JSON.stringify(updatedNotifications),
    );
  };

  // Obter ícone com base no título da notificação
  const getNotificationIcon = (title: string) => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes("rota") && lowerTitle.includes("excluída")) {
      return <Trash2 className="h-4 w-4 text-red-500" />;
    } else if (
      lowerTitle.includes("rota") &&
      lowerTitle.includes("importada")
    ) {
      return <Route className="h-4 w-4 text-green-500" />;
    } else if (lowerTitle.includes("exportação")) {
      return <FileSpreadsheet className="h-4 w-4 text-blue-500" />;
    } else if (lowerTitle.includes("erro")) {
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    } else {
      return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  // Formatar tempo relativo
  const formatRelativeTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch (error) {
      return "tempo desconhecido";
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative rounded-full bg-white hover:bg-gray-100 border-gray-200"
        >
          <Bell className="h-5 w-5 text-gray-600" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 mr-4 shadow-lg rounded-xl border border-gray-200"
        align="end"
      >
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-3 rounded-t-xl flex justify-between items-center">
          <h3 className="font-semibold">Notificações</h3>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-white hover:bg-orange-600/50"
                onClick={markAllAsRead}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Marcar todas como lidas
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-white hover:bg-orange-600/50"
                onClick={clearAllNotifications}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[300px] p-0">
          {notifications.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 hover:bg-gray-50 transition-colors ${!notification.read ? "bg-orange-50" : ""}`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.title)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium text-sm text-gray-900 truncate">
                          {notification.title}
                        </h4>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                          {formatRelativeTime(notification.time)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {notification.message}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <Bell className="h-12 w-12 text-gray-300 mb-3" />
              <h4 className="text-gray-500 font-medium mb-1">
                Nenhuma notificação
              </h4>
              <p className="text-gray-400 text-sm">
                As notificações sobre rotas e exportações aparecerão aqui.
              </p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
