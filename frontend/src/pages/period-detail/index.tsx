import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePeriodDetail } from './usePeriodDetail'
import { PeriodHeader } from './PeriodHeader'
import { PeriodSummaryCards } from './PeriodSummaryCards'
import { PeriodActionBar } from './PeriodActionBar'
import { EvnInvoicesTab } from './tabs/EvnInvoicesTab'
import { ReadingsTab } from './tabs/ReadingsTab'
import { BillsTab } from './tabs/BillsTab'
import { ReviewDialog } from './dialogs/ReviewDialog'
import { AddInvoiceDialog } from './dialogs/AddInvoiceDialog'
import { EditPeriodDialog } from './dialogs/EditPeriodDialog'
import { RecordPaymentDialog } from './dialogs/RecordPaymentDialog'
import { GenerationProgressDialog } from './dialogs/GenerationProgressDialog'

export default function PeriodDetailPage() {
  const ctx = usePeriodDetail()

  if (ctx.loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (!ctx.period) return <div className="p-6 text-destructive">Không tìm thấy kỳ.</div>

  const { period } = ctx

  return (
    <div className="p-4 md:p-6 space-y-4">

      <PeriodHeader
        period={period}
        isAccountant={ctx.isAccountant}
        onEditClick={() => {
          ctx.setEditPeriodForm({ name: period.name, serviceFee: period.serviceFee, extraFee: period.extraFee })
          ctx.setEditPeriodOpen(true)
        }}
      />

      <PeriodSummaryCards
        period={period}
        submittedCount={ctx.submittedCount}
        readingsTotal={ctx.readings.length}
        totalConsumption={ctx.totalConsumption}
      />

      <PeriodActionBar
        period={period}
        isAdmin={ctx.isAdmin}
        isAccountant={ctx.isAccountant}
        invoicesCount={ctx.invoices.length}
        bills={ctx.bills}
        actionLoading={ctx.actionLoading}
        onAction={ctx.handleAction}
        onReview={ctx.handleReview}
        onAddInvoice={() => ctx.setAddInvoiceOpen(true)}
        onGenerateBills={ctx.handleGenerateBills}
        onPrintPack={ctx.handlePrintPack}
      />

      {/* Tab navigation */}
      <div
        className="flex gap-0 overflow-x-auto"
        style={{ borderBottom: '1px solid hsl(var(--border))' }}
      >
        {ctx.tabList.map(([t, label]) => (
          <button
            key={t}
            onClick={() => ctx.setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex-shrink-0',
              ctx.tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {ctx.tab === 'invoices' && (
        <EvnInvoicesTab
          invoices={ctx.invoices}
          canAddInvoice={ctx.canAddInvoice}
          onDelete={ctx.handleDeleteInvoice}
        />
      )}

      {ctx.tab === 'readings' && (
        <ReadingsTab
          period={period}
          readings={ctx.readings}
          displayReadings={ctx.displayReadings}
          submittedCount={ctx.submittedCount}
          canSubmitReadings={ctx.canSubmitReadings}
          isAdmin={ctx.isAdmin}
          userRole={ctx.user?.role}
          readingInputs={ctx.readingInputs}
          setReadingInputs={ctx.setReadingInputs}
          submittingId={ctx.submittingId}
          recentlyDoneId={ctx.recentlyDoneId}
          editingReadingId={ctx.editingReadingId}
          setEditingReadingId={ctx.setEditingReadingId}
          editReadingInput={ctx.editReadingInput}
          setEditReadingInput={ctx.setEditReadingInput}
          actionLoading={ctx.actionLoading}
          readingSearch={ctx.readingSearch}
          setReadingSearch={ctx.setReadingSearch}
          readingSubmittedFilter={ctx.readingSubmittedFilter}
          setReadingSubmittedFilter={ctx.setReadingSubmittedFilter}
          readingSort={ctx.readingSort}
          toggleReadingSort={ctx.toggleReadingSort}
          onSubmitReading={ctx.handleSubmitReading}
          onEditReading={ctx.handleEditReading}
          onSubmitAllReadings={ctx.handleSubmitAllReadings}
        />
      )}

      {ctx.tab === 'bills' && (
        <BillsTab
          period={period}
          bills={ctx.bills}
          displayBills={ctx.displayBills}
          showBillActions={ctx.showBillActions}
          isAccountant={ctx.isAccountant}
          selectedBillIds={ctx.selectedBillIds}
          setSelectedBillIds={ctx.setSelectedBillIds}
          sendingSms={ctx.sendingSms}
          billSearch={ctx.billSearch}
          setBillSearch={ctx.setBillSearch}
          billStatusFilter={ctx.billStatusFilter}
          setBillStatusFilter={ctx.setBillStatusFilter}
          billSort={ctx.billSort}
          toggleSort={ctx.toggleSort}
          onPaymentForm={ctx.openPaymentForm}
          onMarkSent={ctx.handleMarkSent}
          onZaloLink={ctx.handleZaloLink}
          onViewPdf={ctx.handleViewPdf}
          onSendSms={ctx.handleSendSms}
          setPaymentBill={ctx.setPaymentBill}
          setPaymentForm={ctx.setPaymentForm}
        />
      )}

      <ReviewDialog
        open={ctx.reviewOpen}
        onClose={() => ctx.setReviewOpen(false)}
        reviewData={ctx.reviewData}
        reviewLoading={ctx.reviewLoading}
      />

      <AddInvoiceDialog
        open={ctx.addInvoiceOpen}
        onOpenChange={ctx.setAddInvoiceOpen}
        invoiceForm={ctx.invoiceForm}
        setInvoiceForm={ctx.setInvoiceForm}
        onSubmit={ctx.handleAddInvoice}
        actionLoading={ctx.actionLoading}
      />

      <EditPeriodDialog
        open={ctx.editPeriodOpen}
        onOpenChange={ctx.setEditPeriodOpen}
        periodCode={period.code}
        editPeriodForm={ctx.editPeriodForm}
        setEditPeriodForm={ctx.setEditPeriodForm}
        onSubmit={ctx.handleEditPeriod}
        editPeriodSaving={ctx.editPeriodSaving}
        editPeriodError={ctx.editPeriodError}
      />

      <RecordPaymentDialog
        paymentBill={ctx.paymentBill}
        onClose={() => ctx.setPaymentBill(null)}
        paymentForm={ctx.paymentForm}
        setPaymentForm={ctx.setPaymentForm}
        onSubmit={ctx.handleAddPayment}
        actionLoading={ctx.actionLoading}
      />

      <GenerationProgressDialog
        open={ctx.generating}
        genProgress={ctx.genProgress}
        onCancel={ctx.cancelGeneration}
      />

    </div>
  )
}
