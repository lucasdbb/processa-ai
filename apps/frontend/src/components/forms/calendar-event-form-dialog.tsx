import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ClientSelect } from '@/components/ui/client-select'
import { ProcessSelect } from '@/components/ui/process-select'
import {
  calendarService,
  type EventType,
  type CalendarEvent,
  type DeadlinePriority,
} from '@/services/calendar-service'
import { analytics } from '@/lib/analytics'

const EVENT_TYPE_OPTIONS: { value: EventType; label: string; color: string }[] = [
  { value: 'audiencia', label: 'Audiência', color: '#ef4444' },
  { value: 'prazo', label: 'Prazo', color: '#f59e0b' },
  { value: 'reuniao', label: 'Reunião', color: '#3b82f6' },
  { value: 'other', label: 'Outros', color: '#6b7280' },
]

const PRIORITY_OPTIONS: { value: DeadlinePriority; label: string; color: string }[] = [
  { value: 'low', label: 'Baixa', color: 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400' },
  { value: 'medium', label: 'Média', color: 'border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' },
  { value: 'high', label: 'Alta', color: 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400' },
  { value: 'urgent', label: 'Urgente', color: 'border-red-700 bg-red-700/10 text-red-800 dark:text-red-300' },
]

interface CalendarEventFormDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  event?: CalendarEvent
  defaultDate?: string
  defaultProcessId?: string
  defaultClientId?: string
  defaultEventType?: EventType
}

export function CalendarEventFormDialog({
  isOpen,
  onClose,
  onSave,
  event,
  defaultDate,
  defaultProcessId,
  defaultClientId,
  defaultEventType,
}: CalendarEventFormDialogProps) {
  const isEditing = !!event

  const getDefaultStart = () => {
    if (event?.start_at) return event.start_at.slice(0, 16)
    if (defaultDate) return `${defaultDate}T09:00`
    const now = new Date()
    now.setHours(now.getHours() + 1, 0, 0, 0)
    return now.toISOString().slice(0, 16)
  }

  const getDefaultEnd = () => {
    if (event?.end_at) return event.end_at.slice(0, 16)
    if (defaultDate) return `${defaultDate}T10:00`
    const now = new Date()
    now.setHours(now.getHours() + 2, 0, 0, 0)
    return now.toISOString().slice(0, 16)
  }

  const [title, setTitle] = useState(event?.title || '')
  const [description, setDescription] = useState(event?.description || '')
  const [location, setLocation] = useState(event?.location || '')
  const [startAt, setStartAt] = useState(getDefaultStart())
  const [endAt, setEndAt] = useState(getDefaultEnd())
  const [allDay, setAllDay] = useState(event?.all_day || false)
  const [eventType, setEventType] = useState<EventType>(event?.event_type || defaultEventType || 'other')
  const [processoId, setProcessoId] = useState(event?.processo_id || defaultProcessId || '')
  const [clienteId, setClienteId] = useState(event?.cliente_id || defaultClientId || '')
  const [priority, setPriority] = useState<DeadlinePriority>(event?.priority || 'medium')
  const [reminderDaysBefore, setReminderDaysBefore] = useState(event?.reminder_days_before ?? 3)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen) {
      setTitle(event?.title || '')
      setDescription(event?.description || '')
      setLocation(event?.location || '')
      setStartAt(getDefaultStart())
      setEndAt(getDefaultEnd())
      setAllDay(event?.all_day || false)
      setEventType(event?.event_type || defaultEventType || 'other')
      setProcessoId(event?.processo_id || defaultProcessId || '')
      setClienteId(event?.cliente_id || defaultClientId || '')
      setPriority(event?.priority || 'medium')
      setReminderDaysBefore(event?.reminder_days_before ?? 3)
      setShowDeleteConfirm(false)
      setErrors({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, event, defaultProcessId, defaultClientId, defaultEventType])

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!title.trim()) newErrors.title = 'Título é obrigatório'
    if (!startAt) newErrors.startAt = 'Data de início é obrigatória'
    if (!endAt) newErrors.endAt = 'Data de término é obrigatória'
    if (startAt && endAt && new Date(startAt) >= new Date(endAt)) {
      newErrors.endAt = 'Data de término deve ser após a data de início'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setIsSaving(true)
    try {
      const data = {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        all_day: allDay,
        event_type: eventType,
        processo_id: processoId || undefined,
        cliente_id: clienteId || undefined,
        color: EVENT_TYPE_OPTIONS.find((o) => o.value === eventType)?.color,
        priority: eventType === 'prazo' ? priority : undefined,
        deadline_status: eventType === 'prazo' && !isEditing ? 'pending' as const : undefined,
        reminder_days_before: eventType === 'prazo' ? reminderDaysBefore : undefined,
      }

      if (isEditing && event) {
        await calendarService.updateEvent(event.id, data)
        analytics.track('office_action', { entity: 'calendar_event', action: 'updated', event_type: eventType })
        toast.success('Evento atualizado com sucesso')
      } else {
        await calendarService.createEvent(data)
        analytics.track('office_action', { entity: 'calendar_event', action: 'created', event_type: eventType })
        toast.success('Evento criado com sucesso')
      }
      onSave()
    } catch {
      toast.error(isEditing ? 'Erro ao atualizar evento' : 'Erro ao criar evento')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!event) return
    setIsDeleting(true)
    try {
      await calendarService.deleteEvent(event.id)
      analytics.track('office_action', { entity: 'calendar_event', action: 'deleted' })
      toast.success('Evento excluído com sucesso')
      onSave()
    } catch {
      toast.error('Erro ao excluir evento')
      setShowDeleteConfirm(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Evento' : 'Novo Evento'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Titulo *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Audiência de instrução"
              className={cn(
                'w-full px-3 py-2 bg-background border rounded-lg text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary',
                errors.title ? 'border-destructive' : 'border-border'
              )}
            />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Tipo de Evento
            </label>
            <div className="grid grid-cols-4 gap-2">
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEventType(opt.value)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-medium border transition-all text-center',
                    eventType === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                  )}
                >
                  <div
                    className="w-2 h-2 rounded-full mx-auto mb-1"
                    style={{ backgroundColor: opt.color }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority (only for prazo) */}
          {eventType === 'prazo' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Prioridade
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-xs font-medium border transition-all text-center',
                      priority === opt.value
                        ? opt.color
                        : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reminder Days Before (only for prazo) */}
          {eventType === 'prazo' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Lembrete (dias antes)
              </label>
              <select
                value={reminderDaysBefore}
                onChange={(e) => setReminderDaysBefore(Number(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={0}>Sem lembrete</option>
                <option value={1}>1 dia antes</option>
                <option value={2}>2 dias antes</option>
                <option value={3}>3 dias antes</option>
                <option value={5}>5 dias antes</option>
                <option value={7}>7 dias antes</option>
                <option value={14}>14 dias antes</option>
                <option value={30}>30 dias antes</option>
              </select>
            </div>
          )}

          {/* All Day Toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={cn(
                'w-10 h-6 rounded-full relative transition-colors',
                allDay ? 'bg-primary' : 'bg-muted'
              )}
              onClick={() => setAllDay(!allDay)}
            >
              <div
                className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm',
                  allDay ? 'translate-x-5' : 'translate-x-1'
                )}
              />
            </div>
            <span className="text-sm text-foreground">Dia inteiro</span>
          </label>

          {/* Date/Time */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Inicio *
              </label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? startAt.split('T')[0] : startAt}
                onChange={(e) => setStartAt(allDay ? `${e.target.value}T00:00` : e.target.value)}
                className={cn(
                  'w-full px-3 py-2 bg-background border rounded-lg text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary',
                  errors.startAt ? 'border-destructive' : 'border-border'
                )}
              />
              {errors.startAt && <p className="text-xs text-destructive mt-1">{errors.startAt}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Termino *
              </label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? endAt.split('T')[0] : endAt}
                onChange={(e) => setEndAt(allDay ? `${e.target.value}T23:59` : e.target.value)}
                className={cn(
                  'w-full px-3 py-2 bg-background border rounded-lg text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary',
                  errors.endAt ? 'border-destructive' : 'border-border'
                )}
              />
              {errors.endAt && <p className="text-xs text-destructive mt-1">{errors.endAt}</p>}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Local
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Vara do Trabalho de São Paulo"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Vinculos */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Cliente
              </label>
              <ClientSelect
                value={clienteId}
                onChange={(id: string | null) => setClienteId(id || '')}
                placeholder="Vincular cliente..."
                disabled={isEditing || !!defaultClientId}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Processo
              </label>
              <ProcessSelect
                value={processoId}
                onChange={(id: string | null) => setProcessoId(id || '')}
                clientId={clienteId || undefined}
                placeholder="Vincular processo..."
                disabled={isEditing || !!defaultProcessId}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes do evento..."
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isEditing && (
            <div className="flex-1 flex justify-start">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving || isDeleting}
                  className="px-4 py-2 text-sm font-medium text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={onClose}
            disabled={isSaving || isDeleting}
            className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isDeleting || showDeleteConfirm}
            className="px-4 py-2 text-sm font-medium bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar Evento'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
