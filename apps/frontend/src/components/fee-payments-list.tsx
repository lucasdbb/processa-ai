import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { feePaymentsService, type FeePayment } from '@/services/fee-payments-service'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

interface FeePaymentsListProps {
  feeId: string
  onPaymentChange?: () => void
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR })
  } catch {
    return dateStr
  }
}

export function FeePaymentsList({ feeId, onPaymentChange }: FeePaymentsListProps) {
  const [payments, setPayments] = useState<FeePayment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadPayments = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await feePaymentsService.listByFee(feeId)
      setPayments(response.payments)
    } catch (error) {
      console.error('Error loading payments:', error)
      toast.error('Erro ao carregar pagamentos')
    } finally {
      setIsLoading(false)
    }
  }, [feeId])

  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  const handleDelete = async (paymentId: string) => {
    if (!confirm('Tem certeza que deseja excluir este pagamento?')) return

    try {
      await feePaymentsService.delete(paymentId)
      toast.success('Pagamento excluído com sucesso')
      await loadPayments()
      onPaymentChange?.()
    } catch (error) {
      console.error('Error deleting payment:', error)
      toast.error('Erro ao excluir pagamento')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="sm" />
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>Nenhum pagamento registrado</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">
        Histórico de Pagamentos ({payments.length})
      </p>
      {payments.map((payment) => (
        <div
          key={payment.id}
          className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {formatCurrency(payment.amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(payment.payment_date)}
                {payment.payment_method && ` • ${payment.payment_method}`}
              </p>
              {payment.notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  {payment.notes}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => handleDelete(payment.id)}
            className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
            title="Excluir pagamento"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </button>
        </div>
      ))}
    </div>
  )
}
