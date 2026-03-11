import styled, { ThemeProvider } from 'styled-components'
import { theme } from '~/features/ui/theme'
import { GlobalStyles } from '~/GlobalStyles'
import { useLunchSession } from '~/features/lunch/hooks/useLunchSession'
import { useCalculation } from '~/features/lunch/hooks/useCalculation'
import { OrderSettings } from '~/features/lunch/components/OrderSettings'
import { PeopleSection } from '~/features/lunch/components/PeopleSection'
import { Summary } from '~/features/lunch/components/Summary'
import { CopySummary } from '~/features/lunch/components/CopySummary'

const AppContainer = styled.div`
  max-width: 700px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
`

const Header = styled.h1`
  text-align: center;
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.fontSizes.xxl};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  font-weight: ${({ theme }) => theme.typography.heading.fontWeight};
`

function App() {
  const {
    session,
    setGlobalDiscount,
    addFeeAdjustment,
    updateFeeAdjustment,
    removeFeeAdjustment,
    addPerson,
    removePerson,
    updatePersonName,
    addItem,
    updateItem,
    removeItem,
  } = useLunchSession()

  const { summaries, netFees, feePerPerson, grandTotal } = useCalculation(session)

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <AppContainer>
        <Header>Lunch Splitter</Header>

        <OrderSettings
          globalDiscountPercent={session.globalDiscountPercent}
          feeAdjustments={session.feeAdjustments}
          netFees={netFees}
          feePerPerson={feePerPerson}
          peopleCount={session.people.length}
          onSetGlobalDiscount={setGlobalDiscount}
          onAddFee={addFeeAdjustment}
          onUpdateFee={updateFeeAdjustment}
          onRemoveFee={removeFeeAdjustment}
        />

        <PeopleSection
          people={session.people}
          summaries={summaries}
          globalDiscountPercent={session.globalDiscountPercent}
          onAddPerson={addPerson}
          onRemovePerson={removePerson}
          onUpdatePersonName={updatePersonName}
          onAddItem={addItem}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
        />

        <Summary summaries={summaries} grandTotal={grandTotal} />

        <CopySummary session={session} summaries={summaries} />
      </AppContainer>
    </ThemeProvider>
  )
}

export default App
