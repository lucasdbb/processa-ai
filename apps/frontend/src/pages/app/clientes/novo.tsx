import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { clientsService, type ClientCreate } from '@/services/clients-service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const clientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  cpf_cnpj: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
})

type ClientFormData = z.infer<typeof clientSchema>

export default function ClienteNovoPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [loadingCep, setLoadingCep] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      status: 'active',
    },
  })

  const handleCepBlur = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '')
    
    if (cleanCep.length !== 8) return
    
    try {
      setLoadingCep(true)
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await response.json()
      
      if (data.erro) {
        toast.error('CEP não encontrado')
        return
      }
      
      if (data.logradouro) setValue('address', data.logradouro)
      if (data.localidade) setValue('city', data.localidade)
      if (data.uf) setValue('state', data.uf)
      
      toast.success('Endereço preenchido automaticamente')
    } catch {
      toast.error('Falha ao buscar CEP')
    } finally {
      setLoadingCep(false)
    }
  }

  const onSubmit = async (data: ClientFormData) => {
    try {
      setLoading(true)
      
      const payload: ClientCreate = {
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        cpf_cnpj: data.cpf_cnpj || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        zip_code: data.zip_code || undefined,
        notes: data.notes || undefined,
      }
      
      await clientsService.create(payload)
      toast.success('Cliente criado com sucesso!')
      navigate('/app/clientes')
    } catch {
      toast.error('Falha ao criar cliente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/app/clientes')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      <div className="bg-card border rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-6">Novo Cliente</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Nome completo"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="email@exemplo.com"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-500 mt-1 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  {...register('phone')}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
              <Input
                id="cpf_cnpj"
                {...register('cpf_cnpj')}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h3 className="font-semibold">Endereço</h3>

            <div>
              <Label htmlFor="zip_code">CEP</Label>
              <div className="relative">
                <Input
                  id="zip_code"
                  {...register('zip_code')}
                  placeholder="00000-000"
                  maxLength={9}
                  onBlur={(e) => handleCepBlur(e.target.value)}
                />
                {loadingCep && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Digite o CEP e o endereço será preenchido automaticamente
              </p>
            </div>

            <div>
              <Label htmlFor="address">Logradouro</Label>
              <Input
                id="address"
                {...register('address')}
                placeholder="Rua, número, complemento"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" {...register('city')} placeholder="São Paulo" />
              </div>

              <div>
                <Label htmlFor="state">Estado</Label>
                <Input id="state" {...register('state')} placeholder="SP" maxLength={2} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Observações sobre o cliente"
              rows={4}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Cliente
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/app/clientes')}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
