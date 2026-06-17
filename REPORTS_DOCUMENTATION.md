# Monthly Reports Documentation

## Overview
The Reports page provides comprehensive monthly financial analytics for all departments (Cafe, Bookshop, Food Hut). All reports are **monthly-based** and include data from all departments.

---

## Report Types

### 1. **Monthly Summary Report**
**Purpose:** Comprehensive overview of each department's financial performance

**Shows:**
- Total Sales (per department & combined)
- Total Expenses (per department & combined)
- Credits (per department & combined)
- Profit (per department & combined)
- Profit Margin (%)

**Visualizations:**
- Bar chart: Revenue vs Expenses by department
- Bar chart: Profit by department
- Detailed table with all metrics

**Export:** CSV format

---

### 2. **Expenses by Type Report**
**Purpose:** Breakdown of expenses categorized by type

**Shows:**
- Expense types and amounts
- Percentage of total expenses
- All departments combined

**Visualizations:**
- Pie chart: Distribution of expenses by type
- Bar chart: Expense amounts by type
- Detailed table with amounts and percentages

**Export:** CSV format

---

### 3. **Credit Report**
**Purpose:** Overview of customer credits status

**Shows:**
- Paid credits total
- Unpaid credits total
- All departments combined

**Visualizations:**
- Pie chart: Paid vs Unpaid credits distribution

**Export:** CSV format

---

### 4. **Profit Report** ⭐ (With Staff Salaries)
**Purpose:** Net profit calculation including staff salary deductions

**Formula:**
```
Net Profit = (Total Sales from all departments) 
           - (Total Operating Expenses) 
           - (Total Staff Salaries for the month)
```

**Shows:**
- Total Sales (all departments)
- Operating Expenses (all departments)
- Staff Salaries (from HR module)
- **Net Profit** (after all deductions)

**Visualizations:**
- Summary cards showing each component
- Breakdown bar chart
- Detailed calculation breakdown

**Staff Salary Integration:**
- Automatically pulls salary data from the Staff & HR section
- Includes all admin staff salaries for the selected month
- Accounts for daily rates, work days, and overtime

**Export:** CSV format

---

## Features

### Month Navigation
- Use the month selector to view any previous month's data
- Arrow buttons for quick month switching
- All data automatically updates for the selected month

### Report Type Selector
Switch between reports without changing the month selection

### Export to CSV
- Export any report to CSV format
- Includes report type, month, and generation timestamp
- Ready for spreadsheet analysis

### Data Sources
- **Sales & Expenses:** Daily Cash module
- **Credits:** Credits module
- **Staff Salaries:** Staff & HR module (Salary tab)

---

## API Endpoints Used

```javascript
// Monthly summaries by department
GET /api/daily-cash/monthly/{year}/{month}

// Monthly expenses (all departments)
GET /api/expenses/monthly?year={year}&month={month}

// Monthly credits (all departments)
GET /api/credits/monthly?year={year}&month={month}

// Staff salaries
GET /api/salary/admin/monthly?year={year}&month={month}
```

---

## Usage Examples

### Generate Monthly Summary
1. Navigate to Reports page
2. Select desired month using month picker
3. Select "Monthly Summary" report type
4. View charts and tables showing all departments' performance
5. Click "Export" to download as CSV

### Calculate Net Profit
1. Select the month for profit analysis
2. Click "Profit Report" tab
3. View breakdown of:
   - Total Sales
   - Operating Expenses
   - Staff Salaries deduction
   - Final Net Profit
4. Export for financial records

### Analyze Expense Breakdown
1. Select month
2. Click "Expenses by Type"
3. View which expense categories consume most budget
4. Use pie chart to understand cost distribution
5. Export for accounting review

---

## Technical Implementation

### State Management
```javascript
const [reportType, setReportType] = useState('monthly')
const [selectedMonth, setSelectedMonth] = useState(new Date())
const [shopData, setShopData] = useState([])        // Monthly summary
const [expenseData, setExpenseData] = useState([])  // Expenses by type
const [creditData, setCreditData] = useState([])    // Credit status
const [profitData, setProfitData] = useState(null)  // Profit calculation
```

### Data Loading
All reports load automatically when month changes via `loadMonthlyReport()` function

### CSV Export
Format: Clean, timestamped export with headers and all data

---

## Future Enhancements

- [ ] Top selling items report (FoodHut specific)
- [ ] PDF export option
- [ ] Email report scheduling
- [ ] Year-over-year comparison
- [ ] Department performance trends
- [ ] Custom date range reports


