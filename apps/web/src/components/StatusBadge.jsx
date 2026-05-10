import {
  Clock,
  FileText,
  CheckCircle,
  Calendar,
  Truck,
  Package,
  Navigation,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { statusTone, statusConfig } from "../lib/constants";

const iconMap = {
  Clock,
  FileText,
  CheckCircle,
  Calendar,
  Truck,
  Package,
  Navigation,
  CheckCircle2,
  AlertTriangle,
};

export default function StatusBadge({ status, size = "sm" }) {
  const tone = statusTone[status] || "bg-dropit-300 text-dropit-800 border-dropit-400";
  const config = statusConfig[status] || { label: status, icon: "FileText" };
  const Icon = iconMap[config.icon];

  const sizeClass = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";

  return (
    <span className={`status-pill ${tone} ${sizeClass} gap-1.5 font-medium`}>
      {Icon && <Icon size={size === "sm" ? 14 : 16} className="flex-shrink-0" />}
      {config.label}
    </span>
  );
}
