import { useLocation } from "react-router-dom";
import { useAiTools } from "@/features/ai/context";
import { useCalculators } from "@/features/calculators/context";

export interface BreadcrumbItem {
  label: string;
  href: string;
}

const ROUTE_LABELS: Record<string, string> = {
  app: "Dashboard",
  clientes: "Clientes",
  processos: "Processos",
  prazos: "Prazos",
  calculadoras: "Calculadoras",
  ia: "IA Jurídica",
  documentos: "Documentos",
  materiais: "Materiais",
  configuracoes: "Configurações",
  ajuda: "Ajuda",
  novo: "Novo",
  editar: "Editar",
  detalhes: "Detalhes",
};

export function useBreadcrumbs(): BreadcrumbItem[] {
  const location = useLocation();
  const { getToolBySlug } = useAiTools();
  const { getCalculatorBySlug } = useCalculators();

  // Split pathname and filter empty strings
  const pathSegments = location.pathname.split("/").filter(Boolean);

  // If we're on the dashboard root, return empty array (no breadcrumbs needed)
  if (pathSegments.length === 1 && pathSegments[0] === "app") {
    return [];
  }

  // Build breadcrumb items
  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = "";
  let previousSegment = "";

  pathSegments.forEach((segment) => {
    currentPath += `/${segment}`;

    let label: string;

    // If previous segment was 'ia', this segment is an AI tool slug
    if (previousSegment === "ia") {
      const tool = getToolBySlug(segment);
      label = tool?.name || segment.charAt(0).toUpperCase() + segment.slice(1);
    }
    // If previous segment was 'calculadoras', this segment is a calculator slug
    else if (previousSegment === "calculadoras") {
      const calculator = getCalculatorBySlug(segment);
      label =
        calculator?.name || segment.charAt(0).toUpperCase() + segment.slice(1);
    }
    // If segment looks like a UUID/ID (alphanumeric with dashes), show contextual label
    else if (
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        segment,
      ) ||
      /^\d+$/.test(segment)
    ) {
      // Show the entity type from previous segment
      if (previousSegment === "clientes") {
        label = "Detalhes do Cliente";
      } else if (previousSegment === "processos") {
        label = "Detalhes do Processo";
      } else if (previousSegment === "materiais") {
        label = "Detalhes do Material";
      } else {
        label = "Detalhes";
      }
    } else {
      // Get label from static mapping, or capitalize as fallback
      label =
        ROUTE_LABELS[segment] ||
        segment.charAt(0).toUpperCase() + segment.slice(1);
    }

    breadcrumbs.push({
      label,
      href: currentPath,
    });

    previousSegment = segment;
  });

  return breadcrumbs;
}
