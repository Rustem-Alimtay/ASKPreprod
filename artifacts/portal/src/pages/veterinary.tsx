import { OtherModulesSection } from "@/components/other-modules-section";
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft, 
  Search, 
  Stethoscope, 
  Syringe, 
  FileText, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter
} from "lucide-react";
import { format, addDays, subDays, isAfter, isBefore } from "date-fns";

const horses = [
  { id: "H001", name: "Thunder Storm", breed: "Thoroughbred", age: 8, owner: "John Smith" },
  { id: "H002", name: "Midnight Star", breed: "Arabian", age: 5, owner: "Sarah Johnson" },
  { id: "H003", name: "Golden Spirit", breed: "Quarter Horse", age: 12, owner: "Mike Brown" },
  { id: "H004", name: "Silver Arrow", breed: "Appaloosa", age: 6, owner: "Emily Davis" },
  { id: "H005", name: "Royal Knight", breed: "Hanoverian", age: 9, owner: "David Wilson" },
];

const medicalHistory = [
  { id: 1, horseId: "H001", date: subDays(new Date(), 5), condition: "Minor Colic", treatment: "IV fluids and pain management", veterinarian: "Dr. Anderson", notes: "Resolved within 24 hours", status: "resolved" },
  { id: 2, horseId: "H001", date: subDays(new Date(), 45), condition: "Hoof Abscess", treatment: "Drainage and poultice", veterinarian: "Dr. Martinez", notes: "Full recovery after 2 weeks", status: "resolved" },
  { id: 3, horseId: "H002", date: subDays(new Date(), 10), condition: "Respiratory Infection", treatment: "Antibiotics course", veterinarian: "Dr. Anderson", notes: "Ongoing treatment", status: "in_treatment" },
  { id: 4, horseId: "H003", date: subDays(new Date(), 90), condition: "Lameness - Left Fore", treatment: "Rest and anti-inflammatory", veterinarian: "Dr. Thompson", notes: "Chronic condition, managed", status: "monitoring" },
  { id: 5, horseId: "H004", date: subDays(new Date(), 20), condition: "Dental Issues", treatment: "Tooth extraction", veterinarian: "Dr. Martinez", notes: "Routine check needed in 6 months", status: "resolved" },
  { id: 6, horseId: "H005", date: subDays(new Date(), 3), condition: "Eye Inflammation", treatment: "Topical medication", veterinarian: "Dr. Anderson", notes: "Daily application required", status: "in_treatment" },
];

const vaccinations = [
  { id: 1, horseId: "H001", vaccine: "Tetanus", dateAdministered: subDays(new Date(), 180), nextDue: addDays(new Date(), 185), veterinarian: "Dr. Anderson" },
  { id: 2, horseId: "H001", vaccine: "Influenza", dateAdministered: subDays(new Date(), 90), nextDue: addDays(new Date(), 90), veterinarian: "Dr. Martinez" },
  { id: 3, horseId: "H001", vaccine: "Rabies", dateAdministered: subDays(new Date(), 300), nextDue: addDays(new Date(), 65), veterinarian: "Dr. Anderson" },
  { id: 4, horseId: "H002", vaccine: "Tetanus", dateAdministered: subDays(new Date(), 200), nextDue: addDays(new Date(), 165), veterinarian: "Dr. Thompson" },
  { id: 5, horseId: "H002", vaccine: "Influenza", dateAdministered: subDays(new Date(), 30), nextDue: addDays(new Date(), 150), veterinarian: "Dr. Anderson" },
  { id: 6, horseId: "H002", vaccine: "West Nile", dateAdministered: subDays(new Date(), 150), nextDue: addDays(new Date(), 215), veterinarian: "Dr. Martinez" },
  { id: 7, horseId: "H003", vaccine: "Tetanus", dateAdministered: subDays(new Date(), 350), nextDue: subDays(new Date(), 15), veterinarian: "Dr. Anderson" },
  { id: 8, horseId: "H003", vaccine: "Influenza", dateAdministered: subDays(new Date(), 200), nextDue: subDays(new Date(), 20), veterinarian: "Dr. Thompson" },
  { id: 9, horseId: "H004", vaccine: "Tetanus", dateAdministered: subDays(new Date(), 100), nextDue: addDays(new Date(), 265), veterinarian: "Dr. Martinez" },
  { id: 10, horseId: "H005", vaccine: "Rabies", dateAdministered: subDays(new Date(), 60), nextDue: addDays(new Date(), 305), veterinarian: "Dr. Anderson" },
];

const serviceRecords = [
  { id: 1, horseId: "H001", date: subDays(new Date(), 5), service: "Emergency Visit", practitioner: "Dr. Anderson", cost: 450, notes: "After-hours colic treatment" },
  { id: 2, horseId: "H001", date: subDays(new Date(), 30), service: "Routine Checkup", practitioner: "Dr. Martinez", cost: 150, notes: "Annual wellness exam" },
  { id: 3, horseId: "H002", date: subDays(new Date(), 10), service: "Diagnostic Testing", practitioner: "Dr. Anderson", cost: 320, notes: "Blood work and respiratory analysis" },
  { id: 4, horseId: "H003", date: subDays(new Date(), 14), service: "Farrier Service", practitioner: "James Wilson", cost: 180, notes: "Corrective shoeing" },
  { id: 5, horseId: "H003", date: subDays(new Date(), 90), service: "X-Ray Imaging", practitioner: "Dr. Thompson", cost: 280, notes: "Left foreleg examination" },
  { id: 6, horseId: "H004", date: subDays(new Date(), 20), service: "Dental Procedure", practitioner: "Dr. Martinez", cost: 520, notes: "Tooth extraction under sedation" },
  { id: 7, horseId: "H005", date: subDays(new Date(), 3), service: "Follow-up Visit", practitioner: "Dr. Anderson", cost: 100, notes: "Eye condition reassessment" },
  { id: 8, horseId: "H005", date: subDays(new Date(), 60), service: "Vaccination Visit", practitioner: "Dr. Anderson", cost: 200, notes: "Annual vaccinations" },
];

const statusColors: Record<string, { bg: string; text: string }> = {
  resolved: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400" },
  in_treatment: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" },
  monitoring: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400" },
};

export default function VeterinaryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHorse, setSelectedHorse] = useState<string | null>(null);
  const [vaccineFilter, setVaccineFilter] = useState<string>("all");

  const filteredHorses = horses.filter(
    (horse) =>
      horse.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      horse.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getHorseMedicalHistory = (horseId: string) => medicalHistory.filter((m) => m.horseId === horseId);
  const getHorseVaccinations = (horseId: string) => vaccinations.filter((v) => v.horseId === horseId);
  const getHorseServices = (horseId: string) => serviceRecords.filter((s) => s.horseId === horseId);

  const overdueVaccinations = vaccinations.filter((v) => isBefore(new Date(v.nextDue), new Date()));
  const upcomingVaccinations = vaccinations.filter(
    (v) => isAfter(new Date(v.nextDue), new Date()) && isBefore(new Date(v.nextDue), addDays(new Date(), 30))
  );
  const horsesInTreatment = medicalHistory.filter((m) => m.status === "in_treatment");

  const selectedHorseData = selectedHorse ? horses.find((h) => h.id === selectedHorse) : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/other-systems">
          <Button variant="ghost" size="icon" data-testid="button-back-other-systems">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Veterinary Services</h1>
          <p className="text-muted-foreground">Equine medical records and health tracking</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="stat-total-horses">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Stethoscope className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{horses.length}</p>
              <p className="text-sm text-muted-foreground">Total Horses</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-in-treatment">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{horsesInTreatment.length}</p>
              <p className="text-sm text-muted-foreground">In Treatment</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-overdue-vaccines">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overdueVaccinations.length}</p>
              <p className="text-sm text-muted-foreground">Overdue Vaccines</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-upcoming-vaccines">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <Syringe className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcomingVaccinations.length}</p>
              <p className="text-sm text-muted-foreground">Due in 30 Days</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Horse Directory</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-horses"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="space-y-1 p-2">
                {filteredHorses.map((horse) => (
                  <div
                    key={horse.id}
                    className={`cursor-pointer rounded-lg p-3 hover-elevate ${
                      selectedHorse === horse.id ? "bg-primary/10 ring-1 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedHorse(horse.id)}
                    data-testid={`horse-${horse.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{horse.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {horse.id} - {horse.breed}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {horse.age} yrs
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selectedHorseData ? (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedHorseData.name}</CardTitle>
                    <CardDescription>
                      {selectedHorseData.breed} - Age: {selectedHorseData.age} - Owner: {selectedHorseData.owner}
                    </CardDescription>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">
                    {selectedHorseData.id}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="medical" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="medical" data-testid="tab-medical">
                      <Stethoscope className="mr-2 h-4 w-4" />
                      Medical
                    </TabsTrigger>
                    <TabsTrigger value="vaccinations" data-testid="tab-vaccinations">
                      <Syringe className="mr-2 h-4 w-4" />
                      Vaccines
                    </TabsTrigger>
                    <TabsTrigger value="services" data-testid="tab-services">
                      <FileText className="mr-2 h-4 w-4" />
                      Services
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="medical" className="mt-4">
                    <ScrollArea className="h-[280px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Condition</TableHead>
                            <TableHead>Treatment</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getHorseMedicalHistory(selectedHorseData.id).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                No medical history found
                              </TableCell>
                            </TableRow>
                          ) : (
                            getHorseMedicalHistory(selectedHorseData.id).map((record) => {
                              const statusStyle = statusColors[record.status] || statusColors.resolved;
                              return (
                                <TableRow key={record.id}>
                                  <TableCell className="whitespace-nowrap">
                                    {format(new Date(record.date), "MMM d, yyyy")}
                                  </TableCell>
                                  <TableCell>{record.condition}</TableCell>
                                  <TableCell className="max-w-[200px] truncate">{record.treatment}</TableCell>
                                  <TableCell>
                                    <Badge className={`${statusStyle.bg} ${statusStyle.text} border-0 capitalize`}>
                                      {record.status.replace("_", " ")}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="vaccinations" className="mt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Select value={vaccineFilter} onValueChange={setVaccineFilter}>
                        <SelectTrigger className="w-[160px]" data-testid="select-vaccine-filter">
                          <Filter className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Vaccines</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="due_soon">Due Soon</SelectItem>
                          <SelectItem value="up_to_date">Up to Date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <ScrollArea className="h-[250px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vaccine</TableHead>
                            <TableHead>Administered</TableHead>
                            <TableHead>Next Due</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const horseVaccines = getHorseVaccinations(selectedHorseData.id);
                            const filteredVaccines = horseVaccines.filter((vax) => {
                              const isOverdue = isBefore(new Date(vax.nextDue), new Date());
                              const isDueSoon = !isOverdue && isBefore(new Date(vax.nextDue), addDays(new Date(), 30));
                              if (vaccineFilter === "overdue") return isOverdue;
                              if (vaccineFilter === "due_soon") return isDueSoon;
                              if (vaccineFilter === "up_to_date") return !isOverdue && !isDueSoon;
                              return true;
                            });
                            
                            if (filteredVaccines.length === 0) {
                              return (
                                <TableRow>
                                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                    {vaccineFilter === "all" ? "No vaccination records found" : `No ${vaccineFilter.replace("_", " ")} vaccines`}
                                  </TableCell>
                                </TableRow>
                              );
                            }
                            
                            return filteredVaccines.map((vax) => {
                              const isOverdue = isBefore(new Date(vax.nextDue), new Date());
                              const isDueSoon = !isOverdue && isBefore(new Date(vax.nextDue), addDays(new Date(), 30));
                              return (
                                <TableRow key={vax.id} className={isOverdue ? "bg-red-50 dark:bg-red-900/10" : isDueSoon ? "bg-yellow-50 dark:bg-yellow-900/10" : ""}>
                                  <TableCell className="font-medium">{vax.vaccine}</TableCell>
                                  <TableCell>{format(new Date(vax.dateAdministered), "MMM d, yyyy")}</TableCell>
                                  <TableCell>{format(new Date(vax.nextDue), "MMM d, yyyy")}</TableCell>
                                  <TableCell>
                                    {isOverdue ? (
                                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">
                                        Overdue
                                      </Badge>
                                    ) : isDueSoon ? (
                                      <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">
                                        Due Soon
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
                                        Up to Date
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          })()}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="services" className="mt-4">
                    <ScrollArea className="h-[280px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Practitioner</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getHorseServices(selectedHorseData.id).length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                No service records found
                              </TableCell>
                            </TableRow>
                          ) : (
                            getHorseServices(selectedHorseData.id).map((service) => (
                              <TableRow key={service.id}>
                                <TableCell className="whitespace-nowrap">
                                  {format(new Date(service.date), "MMM d, yyyy")}
                                </TableCell>
                                <TableCell>{service.service}</TableCell>
                                <TableCell>{service.practitioner}</TableCell>
                                <TableCell className="text-right font-medium">
                                  ${service.cost.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center py-20">
              <Stethoscope className="mb-4 h-16 w-16 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">Select a Horse</h3>
              <p className="text-center text-muted-foreground">
                Choose a horse from the directory to view medical records, vaccinations, and service history.
              </p>
            </CardContent>
          )}
        </Card>
      </div>
      <OtherModulesSection />
    </div>
  );
}
