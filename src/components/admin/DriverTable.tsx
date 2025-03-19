import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { calculateDriverStatus } from "@/lib/driverStatus";
import { Search, Filter, Download, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Driver {
  id: string;
  name: string;
  phoneNumber: string;
  email: string;
  primaryRegion: string;
  backupRegions: string[];
  availability: "AM" | "PM" | "OUROBOROS" | "NONE";
  status: "Active" | "Inactive" | "Pending";
  deliveryFee?: number;
  verificationDate?: string | null;
}

interface DriverTableProps {
  drivers?: Driver[];
  onFilterChange?: (filters: any) => void;
  onDriverSelect?: (driver: Driver) => void;
}

const DriverTable = ({
  drivers: initialDrivers = [],
  onFilterChange = () => {},
  onDriverSelect = () => {},
}: DriverTableProps) => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [regionFilter, setRegionFilter] = useState("All");
  const [availabilityFilter, setAvailabilityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Driver;
    direction: "ascending" | "descending";
  } | null>(null);

  // Fetch real drivers from Supabase and set up real-time updates with optimized polling
  useEffect(() => {
    // Set up a polling interval for real-time updates with longer interval
    const interval = setInterval(() => {
      fetchDrivers();
    }, 60000); // Poll every 60 seconds to reduce server load

    // Initial fetch
    fetchDrivers();

    return () => clearInterval(interval);
  }, []);

  const fetchDrivers = async () => {
    try {
      setIsLoading(true);

      // Get all non-admin users with their related data - limit to improve performance
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select(
          `
          id,
          full_name,
          phone_number,
          email,
          regions(primary_region, backup_regions),
          driver_verification(delivery_fee, created_at, updated_at),
          availability(shift, date)
        `,
        )
        .eq("is_admin", false)
        .limit(100);

      if (usersError) {
        console.error("Error fetching users:", usersError);
        setIsLoading(false);
        return;
      }

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split("T")[0];

      // Transform the data into the Driver interface format
      const transformedDrivers: Driver[] =
        users?.map((user) => {
          // Get the most recent verification
          const verification = user.driver_verification?.[0];
          const verificationDate =
            verification?.updated_at || verification?.created_at || null;

          // Get today's availability
          const todayAvailability = user.availability?.find(
            (a) => a.date === today,
          );

          // Calculate status based on verification date
          const driverStatus = calculateDriverStatus(verificationDate);

          return {
            id: user.id,
            name: user.full_name || "Sem nome",
            phoneNumber: user.phone_number || "",
            email: user.email || "",
            primaryRegion: user.regions?.[0]?.primary_region || "",
            backupRegions: user.regions?.[0]?.backup_regions || [],
            availability: todayAvailability?.shift || "NONE",
            status:
              driverStatus === "active"
                ? "Active"
                : driverStatus === "pending"
                  ? "Pending"
                  : "Inactive",
            deliveryFee: verification?.delivery_fee,
            verificationDate: verificationDate,
          };
        }) || [];

      setDrivers(transformedDrivers);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      setIsLoading(false);
    }
  };

  // Filter drivers based on search term and filters - memoized for performance
  const filteredDrivers = React.useMemo(() => {
    return drivers.filter((driver) => {
      // Otimização: só fazer toLowerCase uma vez para cada termo de busca
      const searchTermLower = searchTerm.toLowerCase();
      const nameLower = driver.name.toLowerCase();
      const emailLower = driver.email.toLowerCase();

      const matchesSearch =
        nameLower.includes(searchTermLower) ||
        driver.phoneNumber.includes(searchTerm) ||
        emailLower.includes(searchTermLower) ||
        driver.id.includes(searchTerm);

      const matchesRegion =
        regionFilter === "All" ||
        driver.primaryRegion === regionFilter ||
        (driver.backupRegions && driver.backupRegions.includes(regionFilter));

      const matchesAvailability =
        availabilityFilter === "All" ||
        driver.availability === availabilityFilter;

      const matchesStatus =
        statusFilter === "All" || driver.status === statusFilter;

      return (
        matchesSearch && matchesRegion && matchesAvailability && matchesStatus
      );
    });
  }, [drivers, searchTerm, regionFilter, availabilityFilter, statusFilter]);

  // Sort drivers based on sort config - memoized for performance
  const sortedDrivers = React.useMemo(() => {
    const sorted = [...filteredDrivers];
    if (sortConfig !== null) {
      sorted.sort((a, b) => {
        // Tratamento para valores nulos ou undefined
        const aValue = a[sortConfig.key] ?? "";
        const bValue = b[sortConfig.key] ?? "";

        if (aValue < bValue) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }
    return sorted;
  }, [filteredDrivers, sortConfig]);

  const requestSort = (key: keyof Driver) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Driver) => {
    if (!sortConfig || sortConfig.key !== key) {
      return null;
    }
    return sortConfig.direction === "ascending" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const getAvailabilityBadge = (availability: Driver["availability"]) => {
    switch (availability) {
      case "AM":
        return <Badge variant="secondary">AM</Badge>;
      case "PM":
        return <Badge variant="secondary">PM</Badge>;
      case "OUROBOROS":
        return <Badge variant="default">OUROBOROS</Badge>;
      default:
        return <Badge variant="outline">None</Badge>;
    }
  };

  const getStatusBadge = (status: Driver["status"]) => {
    switch (status) {
      case "Active":
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            Ativo
          </Badge>
        );
      case "Inactive":
        return (
          <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">
            Inativo
          </Badge>
        );
      case "Pending":
        return (
          <Badge
            variant="outline"
            className="text-amber-500 border-amber-500 hover:bg-amber-50"
          >
            Pendente
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-lg border border-orange-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-orange-600">
            Gerenciamento de Motoristas
          </h2>
          <p className="text-gray-500">
            Visualize e gerencie todos os motoristas cadastrados
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-orange-400" />
            <Input
              placeholder="Buscar motoristas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 border-orange-200 focus:border-orange-400 focus:ring-orange-200"
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 mb-6 bg-orange-50 p-4 rounded-lg border border-orange-100">
        <div className="w-full sm:w-auto">
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Região" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">Todas as Regiões</SelectItem>
              <SelectItem value="ARARICA">ARARICA</SelectItem>
              <SelectItem value="BOM PRINCIPIO">BOM PRINCIPIO</SelectItem>
              <SelectItem value="CAMPO BOM">CAMPO BOM</SelectItem>
              <SelectItem value="CAPELA DE SANTANA">
                CAPELA DE SANTANA
              </SelectItem>
              <SelectItem value="DOIS IRMAOS">DOIS IRMAOS</SelectItem>
              <SelectItem value="ESTANCIA VELHA">ESTANCIA VELHA</SelectItem>
              <SelectItem value="ESTEIO">ESTEIO</SelectItem>
              <SelectItem value="HARMONIA">HARMONIA</SelectItem>
              <SelectItem value="IGREJINHA">IGREJINHA</SelectItem>
              <SelectItem value="IVOTI">IVOTI</SelectItem>
              <SelectItem value="LINDOLFO COLLOR">LINDOLFO COLLOR</SelectItem>
              <SelectItem value="MONTENEGRO">MONTENEGRO</SelectItem>
              <SelectItem value="MORRO REUTER">MORRO REUTER</SelectItem>
              <SelectItem value="NOVA HARTZ">NOVA HARTZ</SelectItem>
              <SelectItem value="NOVO HAMBURGO">NOVO HAMBURGO</SelectItem>
              <SelectItem value="PARECI NOVO">PARECI NOVO</SelectItem>
              <SelectItem value="PAROBE">PAROBE</SelectItem>
              <SelectItem value="PICADA CAFE">PICADA CAFE</SelectItem>
              <SelectItem value="PORTAO">PORTAO</SelectItem>
              <SelectItem value="PRESIDENTE LUCENA">
                PRESIDENTE LUCENA
              </SelectItem>
              <SelectItem value="RIOZINHO">RIOZINHO</SelectItem>
              <SelectItem value="ROLANTE">ROLANTE</SelectItem>
              <SelectItem value="SANTA MARIA DO HERVAL">
                SANTA MARIA DO HERVAL
              </SelectItem>
              <SelectItem value="SAO JOSE DO HORTENCIO">
                SAO JOSE DO HORTENCIO
              </SelectItem>
              <SelectItem value="SAO LEOPOLDO">SAO LEOPOLDO</SelectItem>
              <SelectItem value="SAO SEBASTIAO DO CAI">
                SAO SEBASTIAO DO CAI
              </SelectItem>
              <SelectItem value="SAPIRANGA">SAPIRANGA</SelectItem>
              <SelectItem value="SAPUCAIA DO SUL">SAPUCAIA DO SUL</SelectItem>
              <SelectItem value="TAQUARA">TAQUARA</SelectItem>
              <SelectItem value="TRES COROAS">TRES COROAS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-auto">
          <Select
            value={availabilityFilter}
            onValueChange={setAvailabilityFilter}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Disponibilidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">Toda Disponibilidade</SelectItem>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
              <SelectItem value="OUROBOROS">OUROBOROS</SelectItem>
              <SelectItem value="NONE">Nenhuma</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">Todos os Status</SelectItem>
              <SelectItem value="Active">Ativo</SelectItem>
              <SelectItem value="Inactive">Inativo</SelectItem>
              <SelectItem value="Pending">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center items-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <span className="ml-3">Carregando motoristas...</span>
        </div>
      ) : (
        <div className="border border-orange-100 rounded-lg overflow-hidden shadow-md">
          <Table>
            <TableHeader className="bg-gradient-to-r from-orange-50 to-white">
              <TableRow>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => requestSort("name")}
                >
                  <div className="flex items-center">
                    Nome {getSortIcon("name")}
                  </div>
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => requestSort("primaryRegion")}
                >
                  <div className="flex items-center">
                    Região Principal {getSortIcon("primaryRegion")}
                  </div>
                </TableHead>
                <TableHead>Regiões de Backup</TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => requestSort("availability")}
                >
                  <div className="flex items-center">
                    Disponibilidade {getSortIcon("availability")}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => requestSort("status")}
                >
                  <div className="flex items-center">
                    Status {getSortIcon("status")}
                  </div>
                </TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedDrivers.length > 0 ? (
                sortedDrivers.map((driver) => (
                  <TableRow
                    key={driver.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onDriverSelect(driver)}
                  >
                    <TableCell className="font-medium">{driver.name}</TableCell>
                    <TableCell>{driver.email}</TableCell>
                    <TableCell>{driver.primaryRegion}</TableCell>
                    <TableCell>
                      {driver.backupRegions.length > 0
                        ? driver.backupRegions.length > 2
                          ? `${driver.backupRegions.slice(0, 2).join(", ")} +${driver.backupRegions.length - 2}`
                          : driver.backupRegions.join(", ")
                        : "Nenhuma"}
                    </TableCell>
                    <TableCell>
                      {getAvailabilityBadge(driver.availability)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(driver.status)}
                        {driver.availability !== "NONE" && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full ml-2">
                            {format(new Date(), "dd/MM/yyyy")} -{" "}
                            {driver.availability}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          alert(
                            `Detalhes do motorista: ${driver.name}\nTaxa de Entrega: ${driver.deliveryFee || "N/A"}%\nÚltima Verificação: ${driver.verificationDate ? new Date(driver.verificationDate).toLocaleDateString() : "Nunca"}`,
                          );
                        }}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center p-8">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <Truck className="h-12 w-12 text-orange-200 mb-3" />
                      <p className="font-medium">
                        Nenhum motorista encontrado com os filtros atuais.
                      </p>
                      <p className="text-sm">
                        Tente ajustar os critérios de busca.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="mt-4 flex justify-between items-center bg-orange-50 p-3 rounded-lg border border-orange-100">
        <div className="text-sm font-medium text-orange-700">
          Mostrando {sortedDrivers.length} de {drivers.length} motoristas
        </div>
      </div>
    </div>
  );
};

export default DriverTable;
