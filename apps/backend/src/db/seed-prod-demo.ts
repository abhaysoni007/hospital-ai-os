/**
 * MEDORA — Production Neon Synthetic Hospital Data Seed
 *
 * Populates the production database with a complete, coherent, professional
 * synthetic dataset around the authoritative 13 staff accounts and 6 departments.
 *
 * Idempotent: safe to run multiple times without duplicating rows.
 * Production Safe: Never drops, truncates, or disables constraints.
 */
import postgres from 'postgres';
import bcrypt from 'bcrypt';
import crypto, { randomUUID, createHash } from 'crypto';
import https from 'https';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Helper to fetch database URL from environment or Render
async function getDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')) {
    return process.env.DATABASE_URL;
  }
  const renderApiKey = process.env.RENDER_API_KEY;
  if (!renderApiKey) {
    throw new Error('DATABASE_URL or RENDER_API_KEY must be provided.');
  }
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      path: '/v1/services/srv-dadrmbqd0e5s73e3bvc0/env-vars',
      headers: { 'Authorization': `Bearer ${renderApiKey}` },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const dbVar = json.find((item: any) => item.envVar.key === 'DATABASE_URL');
          if (dbVar) resolve(dbVar.envVar.value);
          else reject(new Error('DATABASE_URL not found on Render'));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function jsonbCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonbCanonical);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => {
      if (a.length !== b.length) return a.length - b.length;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    return Object.fromEntries(entries.map(([k, v]) => [k, jsonbCanonical(v)]));
  }
  return value;
}

// ---------------------------------------------------------------------------
// Main Seed Function
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(65));
  console.log('MEDORA — PRODUCTION NEON DATA SEED');
  console.log('='.repeat(65));

  const dbUrl = await getDatabaseUrl();
  const sql = postgres(dbUrl, { max: 5, ssl: 'require' });

  try {
    const dbInfo = await sql`SELECT current_database(), current_user`;
    console.log(`Connected to database: ${dbInfo[0].current_database} as ${dbInfo[0].current_user}\n`);

    // -----------------------------------------------------------------------
    // [1] Verify Departments & Staff
    // -----------------------------------------------------------------------
    console.log('--- [1] Departments & Staff Check ---');
    const depts = await sql`SELECT id, code, name FROM departments`;
    const deptMap: Record<string, string> = {};
    for (const d of depts) {
      deptMap[d.code] = d.id;
    }
    console.log(`Verified ${depts.length} departments:`, Object.keys(deptMap).join(', '));

    const staffRows = await sql`
      SELECT s.id, s.employee_id, s.email, s.first_name, s.last_name, s.role, d.code as dept_code
      FROM staff s
      LEFT JOIN departments d ON s.department_id = d.id
    `;
    const staffMap: Record<string, any> = {};
    for (const s of staffRows) {
      staffMap[s.email] = s;
    }
    console.log(`Verified ${staffRows.length} authoritative staff accounts in DB.`);

    const docRajan = staffMap['rajan.mehta@hospital.test'];
    const docSneha = staffMap['sneha.patel@hospital.test'];
    const docVikram = staffMap['vikram.singh@hospital.test'];
    const docAnjali = staffMap['anjali.desai@hospital.test'];
    const docRahul = staffMap['rahul.sharma@hospital.test'];
    const nursePriya = staffMap['priya.verma@hospital.test'];
    const nurseNeha = staffMap['neha.gupta@hospital.test'];
    const labKaran = staffMap['karan.malhotra@hospital.test'];
    const labAnita = staffMap['anita.rao@hospital.test'];
    const recPooja = staffMap['pooja.iyer@hospital.test'];
    const pharmSuresh = staffMap['suresh.joshi@hospital.test'];
    const secAmit = staffMap['amit.yadav@hospital.test'];
    const adminDeepak = staffMap['deepak.chopra@hospital.test'];

    if (!docRajan || !labKaran || !recPooja || !pharmSuresh || !secAmit || !adminDeepak) {
      throw new Error('Crucial staff accounts missing from database!');
    }

    const doctors = [docRajan, docSneha, docVikram, docAnjali, docRahul];

    // -----------------------------------------------------------------------
    // [2] Critical Value Rules
    // -----------------------------------------------------------------------
    console.log('\n--- [2] Critical Value Rules ---');
    const rulesToSeed = [
      { testCode: 'CBC', param: 'Hemoglobin', unit: 'g/dL', nLow: 12.0, nHigh: 17.5, cLow: 7.0, cHigh: 20.0 },
      { testCode: 'CBC', param: 'WBC', unit: '10^3/uL', nLow: 4.5, nHigh: 11.0, cLow: 2.0, cHigh: 30.0 },
      { testCode: 'CBC', param: 'Platelets', unit: '10^3/uL', nLow: 150.0, nHigh: 400.0, cLow: 50.0, cHigh: 1000.0 },
      { testCode: 'BMP', param: 'Sodium', unit: 'mEq/L', nLow: 136.0, nHigh: 145.0, cLow: 120.0, cHigh: 160.0 },
      { testCode: 'BMP', param: 'Potassium', unit: 'mEq/L', nLow: 3.5, nHigh: 5.0, cLow: 2.8, cHigh: 6.5 },
      { testCode: 'BMP', param: 'Glucose', unit: 'mg/dL', nLow: 70.0, nHigh: 100.0, cLow: 40.0, cHigh: 500.0 },
      { testCode: 'BMP', param: 'Creatinine', unit: 'mg/dL', nLow: 0.6, nHigh: 1.2, cLow: null, cHigh: 10.0 },
      { testCode: 'LFT', param: 'ALT', unit: 'U/L', nLow: 7.0, nHigh: 56.0, cLow: null, cHigh: 1000.0 },
      { testCode: 'LFT', param: 'Bilirubin', unit: 'mg/dL', nLow: 0.1, nHigh: 1.2, cLow: null, cHigh: 15.0 },
      { testCode: 'TROP', param: 'Troponin I', unit: 'ng/mL', nLow: null, nHigh: 0.04, cLow: null, cHigh: 2.0 },
    ];

    const ruleIdMap: Record<string, string> = {};
    for (const r of rulesToSeed) {
      let existing = await sql`
        SELECT id FROM critical_value_rules
        WHERE test_code = ${r.testCode} AND parameter_name = ${r.param} AND is_active = TRUE
        LIMIT 1
      `;
      if (existing.length === 0) {
        const ins = await sql`
          INSERT INTO critical_value_rules (
            id, test_code, parameter_name, unit, normal_low, normal_high, critical_low, critical_high, is_active, updated_by, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), ${r.testCode}, ${r.param}, ${r.unit}, ${r.nLow}, ${r.nHigh}, ${r.cLow}, ${r.cHigh}, TRUE, ${adminDeepak.id}, now(), now()
          ) RETURNING id
        `;
        ruleIdMap[`${r.testCode}:${r.param}`] = ins[0].id;
        console.log(`  + Created rule ${r.testCode}:${r.param}`);
      } else {
        ruleIdMap[`${r.testCode}:${r.param}`] = existing[0].id;
      }
    }
    console.log(`Critical value rules configured: ${Object.keys(ruleIdMap).length}`);

    // -----------------------------------------------------------------------
    // [3] Patient Population (50 Realistic Indian Patients)
    // -----------------------------------------------------------------------
    console.log('\n--- [3] Patient Population ---');
    const patientDefs = [
      // 10 Showcase Patients
      { mrn: 'MRN-2026-00001', first: 'Ramesh', last: 'Verma', dob: '1964-03-15', gender: 'male', phone: '+919820123456', emName: 'Sunita Verma (Wife)', emPhone: '+919820123457', addr: 'B-402, Sea Green Apts, Worli', city: 'Mumbai', state: 'Maharashtra', pin: '400018', bg: 'B+' },
      { mrn: 'MRN-2026-00002', first: 'Meenakshi', last: 'Sundaram', dob: '1968-07-22', gender: 'female', phone: '+919840123456', emName: 'K. Sundaram (Husband)', emPhone: '+919840123457', addr: '14/2, TTK Road, Alwarpet', city: 'Chennai', state: 'Tamil Nadu', pin: '600018', bg: 'O+' },
      { mrn: 'MRN-2026-00003', first: 'Ananya', last: 'Mukherjee', dob: '1997-11-05', gender: 'female', phone: '+919830123456', emName: 'Debabrata Mukherjee (Father)', emPhone: '+919830123457', addr: '88, Southern Avenue', city: 'Kolkata', state: 'West Bengal', pin: '700029', bg: 'A+' },
      { mrn: 'MRN-2026-00004', first: 'Vijay', last: 'Raghavan', dob: '1981-04-18', gender: 'male', phone: '+919845123456', emName: 'Deepa Raghavan (Wife)', emPhone: '+919845123457', addr: '204, 5th Main, Indiranagar', city: 'Bengaluru', state: 'Karnataka', pin: '560038', bg: 'AB+' },
      { mrn: 'MRN-2026-00005', first: 'Geeta', last: 'Kulkarni', dob: '1959-09-30', gender: 'female', phone: '+919822123456', emName: 'Anand Kulkarni (Son)', emPhone: '+919822123457', addr: 'Plot 12, Prabhat Road, Erandwane', city: 'Pune', state: 'Maharashtra', pin: '411004', bg: 'O-' },
      { mrn: 'MRN-2026-00006', first: 'Harishankar', last: 'Pandey', dob: '1975-01-12', gender: 'male', phone: '+919450123456', emName: 'Shashi Pandey (Brother)', emPhone: '+919450123457', addr: 'D-58/12, Sigra', city: 'Varanasi', state: 'Uttar Pradesh', pin: '221010', bg: 'B+' },
      { mrn: 'MRN-2026-00007', first: 'Sunita', last: 'Deshmukh', dob: '1985-06-25', gender: 'female', phone: '+919890123456', emName: 'Prakash Deshmukh (Husband)', emPhone: '+919890123457', addr: '45, Ramdaspeth', city: 'Nagpur', state: 'Maharashtra', pin: '440010', bg: 'A-' },
      { mrn: 'MRN-2026-00008', first: 'Arun', last: 'Saxena', dob: '1971-08-19', gender: 'male', phone: '+919415123456', emName: 'Madhu Saxena (Wife)', emPhone: '+919415123457', addr: '7/2, Gomti Nagar, Vibhuti Khand', city: 'Lucknow', state: 'Uttar Pradesh', pin: '226010', bg: 'O+' },
      { mrn: 'MRN-2026-00009', first: 'Pooja', last: 'Nambiar', dob: '1992-02-14', gender: 'female', phone: '+919447123456', emName: 'Rohan Nambiar (Brother)', emPhone: '+919447123457', addr: 'Flat 3B, Marine Drive', city: 'Kochi', state: 'Kerala', pin: '682031', bg: 'B-' },
      { mrn: 'MRN-2026-00010', first: 'Kishore', last: 'Chawla', dob: '1954-10-08', gender: 'male', phone: '+919810123456', emName: 'Amit Chawla (Son)', emPhone: '+919810123457', addr: 'C-14, Greater Kailash 1', city: 'New Delhi', state: 'Delhi', pin: '110048', bg: 'A+' },

      // Front Desk Intake / Check-in Cohort
      { mrn: 'MRN-2026-00011', first: 'Devendra', last: 'Tripathi', dob: '1962-12-04', gender: 'male', phone: '+919839123456', emName: 'Rani Tripathi', emPhone: '+919839123457', addr: '112/4, Swaroop Nagar', city: 'Kanpur', state: 'Uttar Pradesh', pin: '208002', bg: 'B+' },
      { mrn: 'MRN-2026-00012', first: 'Shalini', last: 'Swaminathan', dob: '1988-05-16', gender: 'female', phone: '+919842123456', emName: 'S. Swaminathan', emPhone: '+919842123457', addr: '5, West Masi Street', city: 'Madurai', state: 'Tamil Nadu', pin: '625001', bg: 'O+' },
      { mrn: 'MRN-2026-00013', first: 'Rajeshwar', last: 'Rao', dob: '1967-09-28', gender: 'male', phone: '+919849123456', emName: 'Kavita Rao', emPhone: '+919849123457', addr: 'Flat 401, Banjara Hills Rd 12', city: 'Hyderabad', state: 'Telangana', pin: '500034', bg: 'AB+' },
      { mrn: 'MRN-2026-00014', first: 'Aniket', last: 'Sengupta', dob: '1999-03-21', gender: 'male', phone: '+919831123456', emName: 'Sujata Sengupta', emPhone: '+919831123457', addr: '12B, Salt Lake Sector 2', city: 'Kolkata', state: 'West Bengal', pin: '700091', bg: 'A+' },
      { mrn: 'MRN-2026-00015', first: 'Bhavna', last: 'Kothari', dob: '1977-08-11', gender: 'female', phone: '+919825123456', emName: 'Nitin Kothari', emPhone: '+919825123457', addr: '22, Navrangpura', city: 'Ahmedabad', state: 'Gujarat', pin: '380009', bg: 'O-' },
      { mrn: 'MRN-2026-00016', first: 'Manpreet', last: 'Dhillon', dob: '1973-11-29', gender: 'male', phone: '+919814123456', emName: 'Harjit Dhillon', emPhone: '+919814123457', addr: '78, Model Town', city: 'Ludhiana', state: 'Punjab', pin: '141002', bg: 'B+' },
      { mrn: 'MRN-2026-00017', first: 'Deepa', last: 'Vasudevan', dob: '1983-04-03', gender: 'female', phone: '+919446123456', emName: 'K. Vasudevan', emPhone: '+919446123457', addr: 'TC 15/12, Kowdiar', city: 'Thiruvananthapuram', state: 'Kerala', pin: '695003', bg: 'A+' },
      { mrn: 'MRN-2026-00018', first: 'Sandeep', last: 'Mahajan', dob: '1978-06-17', gender: 'male', phone: '+919815123456', emName: 'Ritu Mahajan', emPhone: '+919815123457', addr: 'House 504, Sector 18', city: 'Chandigarh', state: 'Punjab', pin: '160018', bg: 'O+' },

      // Diverse Clinical Cohort (19 - 50)
      { mrn: 'MRN-2026-00019', first: 'Shanti', last: 'Jain', dob: '1956-02-19', gender: 'male', phone: '+919414123456', emName: 'Vikas Jain', emPhone: '+919414123457', addr: '18, C-Scheme', city: 'Jaipur', state: 'Rajasthan', pin: '302001', bg: 'B+' },
      { mrn: 'MRN-2026-00020', first: 'Pratima', last: 'Biswas', dob: '1993-08-07', gender: 'female', phone: '+919434123456', emName: 'Subir Biswas', emPhone: '+919434123457', addr: '4, Hill Cart Road', city: 'Siliguri', state: 'West Bengal', pin: '734001', bg: 'O+' },
      { mrn: 'MRN-2026-00021', first: 'Farooq', last: 'Mir', dob: '1970-01-30', gender: 'male', phone: '+919419123456', emName: 'Bilal Mir', emPhone: '+919419123457', addr: 'Rajbagh Ext', city: 'Srinagar', state: 'Jammu and Kashmir', pin: '190008', bg: 'A+' },
      { mrn: 'MRN-2026-00022', first: 'Urmila', last: 'Patel', dob: '1966-10-14', gender: 'female', phone: '+919824123456', emName: 'Kirit Patel', emPhone: '+919824123457', addr: '56, Ghod Dod Road', city: 'Surat', state: 'Gujarat', pin: '395007', bg: 'AB+' },
      { mrn: 'MRN-2026-00023', first: 'Tarun', last: 'Shah', dob: '1974-05-23', gender: 'male', phone: '+919825223456', emName: 'Mona Shah', emPhone: '+919825223457', addr: '101, Alkapuri', city: 'Vadodara', state: 'Gujarat', pin: '390007', bg: 'B+' },
      { mrn: 'MRN-2026-00024', first: 'Vidya', last: 'Srinivasan', dob: '1980-07-11', gender: 'female', phone: '+919443123456', emName: 'R. Srinivasan', emPhone: '+919443123457', addr: '72, Race Course Road', city: 'Coimbatore', state: 'Tamil Nadu', pin: '641018', bg: 'O+' },
      { mrn: 'MRN-2026-00025', first: 'Mohan', last: 'Sharma', dob: '1958-11-20', gender: 'male', phone: '+919425123456', emName: 'Gopal Sharma', emPhone: '+919425123457', addr: 'E-4, Arera Colony', city: 'Bhopal', state: 'Madhya Pradesh', pin: '462016', bg: 'A-' },
      { mrn: 'MRN-2026-00026', first: 'Rekha', last: 'Yadav', dob: '1989-04-09', gender: 'female', phone: '+919431123456', emName: 'Mukesh Yadav', emPhone: '+919431123457', addr: '15, Bailey Road', city: 'Patna', state: 'Bihar', pin: '800001', bg: 'B+' },
      { mrn: 'MRN-2026-00027', first: 'Alok', last: 'Das', dob: '1982-12-18', gender: 'male', phone: '+919437123456', emName: 'Bijay Das', emPhone: '+919437123457', addr: 'Plot 304, Saheed Nagar', city: 'Bhubaneswar', state: 'Odisha', pin: '751007', bg: 'O+' },
      { mrn: 'MRN-2026-00028', first: 'Kalpana', last: 'Bhattacharya', dob: '1972-03-27', gender: 'female', phone: '+919830223456', emName: 'Amitabha Bhattacharya', emPhone: '+919830223457', addr: '44, Mandirtala', city: 'Howrah', state: 'West Bengal', pin: '711102', bg: 'A+' },
      { mrn: 'MRN-2026-00029', first: 'Sanjay', last: 'Hegde', dob: '1976-09-15', gender: 'male', phone: '+919845223456', emName: 'Mamata Hegde', emPhone: '+919845223457', addr: '12, Kadri Hills', city: 'Mangalore', state: 'Karnataka', pin: '575004', bg: 'AB+' },
      { mrn: 'MRN-2026-00030', first: 'Nirmala', last: 'Roy', dob: '1961-01-08', gender: 'female', phone: '+919431223456', emName: 'Sanjay Roy', emPhone: '+919431223457', addr: '8, Morabadi', city: 'Ranchi', state: 'Jharkhand', pin: '834008', bg: 'B+' },
      { mrn: 'MRN-2026-00031', first: 'Gautam', last: 'Menon', dob: '1995-06-12', gender: 'male', phone: '+919447223456', emName: 'N. Menon', emPhone: '+919447223457', addr: '34, Mavoor Road', city: 'Kozhikode', state: 'Kerala', pin: '673004', bg: 'O+' },
      { mrn: 'MRN-2026-00032', first: 'Preeti', last: 'Chandrasekhar', dob: '1998-10-31', gender: 'female', phone: '+919845323456', emName: 'S. Chandrasekhar', emPhone: '+919845323457', addr: '19, Jayalakshmipuram', city: 'Mysuru', state: 'Karnataka', pin: '570012', bg: 'A+' },
      { mrn: 'MRN-2026-00033', first: 'Jagdish', last: 'Bose', dob: '1952-04-14', gender: 'male', phone: '+919434223456', emName: 'Chanchal Bose', emPhone: '+919434223457', addr: '51, Burnpur Road', city: 'Asansol', state: 'West Bengal', pin: '713304', bg: 'B+' },
      { mrn: 'MRN-2026-00034', first: 'Madhuri', last: 'Joshi', dob: '1969-07-05', gender: 'female', phone: '+919822223456', emName: 'S. Joshi', emPhone: '+919822223457', addr: '6, College Road', city: 'Nashik', state: 'Maharashtra', pin: '422005', bg: 'O+' },
      { mrn: 'MRN-2026-00035', first: 'Suresh', last: 'Reddy', dob: '1965-02-28', gender: 'male', phone: '+919848123456', emName: 'Lakshmi Reddy', emPhone: '+919848123457', addr: 'Plot 8, MG Road', city: 'Vijayawada', state: 'Andhra Pradesh', pin: '520010', bg: 'AB+' },
      { mrn: 'MRN-2026-00036', first: 'Vandana', last: 'Kaushik', dob: '1987-12-09', gender: 'female', phone: '+919412123456', emName: 'Anil Kaushik', emPhone: '+919412123457', addr: '23, Rajpur Road', city: 'Dehradun', state: 'Uttarakhand', pin: '248001', bg: 'A+' },
      { mrn: 'MRN-2026-00037', first: 'Ashok', last: 'Agarwal', dob: '1960-08-16', gender: 'male', phone: '+919412223456', emName: 'Pooja Agarwal', emPhone: '+919412223457', addr: '89, Sanjay Place', city: 'Agra', state: 'Uttar Pradesh', pin: '282002', bg: 'B+' },
      { mrn: 'MRN-2026-00038', first: 'Sudha', last: 'Balasubramanian', dob: '1973-05-02', gender: 'female', phone: '+919443223456', emName: 'K. Balasubramanian', emPhone: '+919443223457', addr: '14, Thillai Nagar', city: 'Tiruchirappalli', state: 'Tamil Nadu', pin: '620018', bg: 'O+' },
      { mrn: 'MRN-2026-00039', first: 'Rakesh', last: 'Nayak', dob: '1979-09-24', gender: 'male', phone: '+919845423456', emName: 'Anita Nayak', emPhone: '+919845423457', addr: '3, Kinnimulky', city: 'Udupi', state: 'Karnataka', pin: '576101', bg: 'A-' },
      { mrn: 'MRN-2026-00040', first: 'Jyoti', last: 'Mohanty', dob: '1990-11-19', gender: 'male', phone: '+919437223456', emName: 'Swati Mohanty', emPhone: '+919437223457', addr: '67, Cantonment Road', city: 'Cuttack', state: 'Odisha', pin: '753001', bg: 'B+' },
      { mrn: 'MRN-2026-00041', first: 'Sunita', last: 'Verma', dob: '1984-03-08', gender: 'female', phone: '+919450223456', emName: 'Rajeev Verma', emPhone: '+919450223457', addr: '12, Civil Lines', city: 'Gorakhpur', state: 'Uttar Pradesh', pin: '273001', bg: 'O+' },
      { mrn: 'MRN-2026-00042', first: 'Hemant', last: 'Patil', dob: '1968-06-27', gender: 'male', phone: '+919822323456', emName: 'Varsha Patil', emPhone: '+919822323457', addr: '45, Tarabai Park', city: 'Kolhapur', state: 'Maharashtra', pin: '416003', bg: 'AB+' },
      { mrn: 'MRN-2026-00043', first: 'Padma', last: 'Subhashree', dob: '1963-01-15', gender: 'female', phone: '+919848223456', emName: 'V. Subhashree', emPhone: '+919848223457', addr: '8, MVP Colony', city: 'Visakhapatnam', state: 'Andhra Pradesh', pin: '530017', bg: 'A+' },
      { mrn: 'MRN-2026-00044', first: 'Chetan', last: 'Bhargava', dob: '1991-07-20', gender: 'male', phone: '+919425223456', emName: 'Neha Bhargava', emPhone: '+919425223457', addr: '29, Old Palasia', city: 'Indore', state: 'Madhya Pradesh', pin: '452001', bg: 'B+' },
      { mrn: 'MRN-2026-00045', first: 'Sarojini', last: 'Cherukuri', dob: '1955-04-26', gender: 'female', phone: '+919848323456', emName: 'M. Cherukuri', emPhone: '+919848323457', addr: '15, Brodipet', city: 'Guntur', state: 'Andhra Pradesh', pin: '522002', bg: 'O+' },
      { mrn: 'MRN-2026-00046', first: 'Tenzing', last: 'Norbu', dob: '1996-09-14', gender: 'male', phone: '+919434323456', emName: 'Doma Norbu', emPhone: '+919434323457', addr: 'Tibet Road', city: 'Gangtok', state: 'Sikkim', pin: '737101', bg: 'A+' },
      { mrn: 'MRN-2026-00047', first: 'Fatima', last: 'Qureshi', dob: '1986-02-03', gender: 'female', phone: '+919823123456', emName: 'Zubair Qureshi', emPhone: '+919823123457', addr: '51, Jubilee Park', city: 'Aurangabad', state: 'Maharashtra', pin: '431001', bg: 'B-' },
      { mrn: 'MRN-2026-00048', first: 'Brijesh', last: 'Tiwari', dob: '1972-10-10', gender: 'male', phone: '+919415223456', emName: 'Sunita Tiwari', emPhone: '+919415223457', addr: '10, George Town', city: 'Prayagraj', state: 'Uttar Pradesh', pin: '211002', bg: 'O+' },
      { mrn: 'MRN-2026-00049', first: 'Lalitha', last: 'Ramakrishnan', dob: '1957-08-01', gender: 'female', phone: '+919443323456', emName: 'V. Ramakrishnan', emPhone: '+919443323457', addr: '22, Fairlands', city: 'Salem', state: 'Tamil Nadu', pin: '636016', bg: 'AB+' },
      { mrn: 'MRN-2026-00050', first: 'Narendra', last: 'Meena', dob: '1980-12-25', gender: 'male', phone: '+919414223456', emName: 'Kiran Meena', emPhone: '+919414223457', addr: '14, Talwandi', city: 'Kota', state: 'Rajasthan', pin: '324005', bg: 'A+' },
    ];

    const patientMap: Record<string, any> = {};
    for (const p of patientDefs) {
      let existing = await sql`SELECT id, mrn FROM patients WHERE mrn = ${p.mrn} LIMIT 1`;
      if (existing.length === 0) {
        const ins = await sql`
          INSERT INTO patients (
            id, mrn, first_name, last_name, date_of_birth, gender, phone_primary, phone_emergency,
            emergency_contact_name, address_line_1, address_city, address_state, address_postal_code,
            status, version, created_by, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), ${p.mrn}, ${p.first}, ${p.last}, ${p.dob}, ${p.gender}, ${p.phone}, ${p.emPhone},
            ${p.emName}, ${p.addr}, ${p.city}, ${p.state}, ${p.pin},
            'active', 1, ${docRajan.id}, now(), now()
          ) RETURNING id, mrn
        `;
        patientMap[p.mrn] = { id: ins[0].id, ...p };
      } else {
        patientMap[p.mrn] = { id: existing[0].id, ...p };
      }
    }
    console.log(`Patients seeded/verified: ${Object.keys(patientMap).length} of 50`);

    // Identities for showcase patients
    for (let i = 1; i <= 15; i++) {
      const p = patientDefs[i - 1];
      const pid = patientMap[p.mrn].id;
      const existId = await sql`SELECT id FROM identities WHERE patient_id = ${pid} LIMIT 1`;
      if (existId.length === 0) {
        await sql`
          INSERT INTO identities (
            id, patient_id, document_type, document_number_enc, verification_status, verified_by, created_at
          ) VALUES (
            gen_random_uuid(), ${pid}, 'aadhaar', ${`XXXX-XXXX-${1000 + i}`}, 'verified', ${recPooja.id}, now()
          )
        `;
      }
    }
    console.log(`Patient identities verified.`);

    // -----------------------------------------------------------------------
    // [4] Encounters (Active & Historical Across Departments)
    // -----------------------------------------------------------------------
    console.log('\n--- [4] Encounters ---');
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);

    const encounterDefs = [
      // 10 Showcase Active/Recent Encounters in Cardiology (CARD)
      { idKey: 'ENC-CARD-001', ptMrn: 'MRN-2026-00001', doc: docRajan, deptCode: 'CARD', type: 'opd', cc: 'Acute severe crushing substernal chest pain radiating to left arm (3h duration)', status: 'active', startedAt: daysAgo(0.1) },
      { idKey: 'ENC-CARD-002', ptMrn: 'MRN-2026-00002', doc: docSneha, deptCode: 'CARD', type: 'opd', cc: 'Routine diabetes and hypertensive nephropathy review; persistent microalbuminuria', status: 'active', startedAt: daysAgo(0.15) },
      { idKey: 'ENC-CARD-003', ptMrn: 'MRN-2026-00003', doc: docVikram, deptCode: 'CARD', type: 'opd', cc: 'Severe fatigue, exertional breathlessness, dizziness, severe pallor', status: 'active', startedAt: daysAgo(0.2) },
      { idKey: 'ENC-CARD-004', ptMrn: 'MRN-2026-00004', doc: docAnjali, deptCode: 'CARD', type: 'opd', cc: 'Stage 2 hypertension follow-up; acute right first MTP joint inflammation (gout)', status: 'active', startedAt: daysAgo(0.25) },
      { idKey: 'ENC-CARD-005', ptMrn: 'MRN-2026-00005', doc: docRahul, deptCode: 'CARD', type: 'opd', cc: 'Worsening exertional dyspnea, orthopnea, bilateral lower limb pitting edema', status: 'active', startedAt: daysAgo(0.3) },
      { idKey: 'ENC-CARD-006', ptMrn: 'MRN-2026-00006', doc: docRahul, deptCode: 'CARD', type: 'opd', cc: 'High-grade fever (102.5°F) for 4 days, severe retro-orbital headache and thrombocytopenia workup', status: 'active', startedAt: daysAgo(0.35) },
      { idKey: 'ENC-CARD-007', ptMrn: 'MRN-2026-00007', doc: docSneha, deptCode: 'CARD', type: 'opd', cc: 'Hypothyroidism management review, generalized cold intolerance and dyslipidemia', status: 'active', startedAt: daysAgo(0.4) },
      { idKey: 'ENC-CARD-008', ptMrn: 'MRN-2026-00008', doc: docRajan, deptCode: 'CARD', type: 'follow_up', cc: '6-month post-PCI follow-up, evaluation of drug-eluting stent patency', status: 'active', startedAt: daysAgo(0.45) },
      { idKey: 'ENC-CARD-009', ptMrn: 'MRN-2026-00009', doc: docVikram, deptCode: 'CARD', type: 'opd', cc: 'Acute severe bronchial asthma exacerbation, audible expiratory wheeze, poor response to inhaler', status: 'active', startedAt: daysAgo(0.05) },
      { idKey: 'ENC-CARD-010', ptMrn: 'MRN-2026-00010', doc: docAnjali, deptCode: 'CARD', type: 'follow_up', cc: 'Chronic kidney disease Stage 3b management, elevated baseline serum creatinine', status: 'active', startedAt: daysAgo(0.5) },

      // Pathology Department Encounters (PATH) — satisfies Lab Technician dashboard queries
      { idKey: 'ENC-PATH-001', ptMrn: 'MRN-2026-00019', doc: docRajan, deptCode: 'PATH', type: 'opd', cc: 'Diagnostic laboratory specimen collection: Fasting plasma glucose and HbA1c panel', status: 'active', startedAt: daysAgo(0.1) },
      { idKey: 'ENC-PATH-002', ptMrn: 'MRN-2026-00020', doc: docSneha, deptCode: 'PATH', type: 'opd', cc: 'STAT laboratory workup: Complete blood count and viral markers', status: 'active', startedAt: daysAgo(0.12) },
      { idKey: 'ENC-PATH-003', ptMrn: 'MRN-2026-00021', doc: docVikram, deptCode: 'PATH', type: 'opd', cc: 'Cardiac biomarker surveillance: Serial Troponin I and basic metabolic panel', status: 'active', startedAt: daysAgo(0.14) },
      { idKey: 'ENC-PATH-004', ptMrn: 'MRN-2026-00022', doc: docAnjali, deptCode: 'PATH', type: 'opd', cc: 'Renal and electrolyte analysis: Serum sodium, potassium and creatinine', status: 'active', startedAt: daysAgo(0.16) },
      { idKey: 'ENC-PATH-005', ptMrn: 'MRN-2026-00023', doc: docRahul, deptCode: 'PATH', type: 'opd', cc: 'Hepatic function assessment: Total bilirubin, ALT, AST and alkaline phosphatase', status: 'active', startedAt: daysAgo(0.18) },
      { idKey: 'ENC-PATH-006', ptMrn: 'MRN-2026-00024', doc: docRajan, deptCode: 'PATH', type: 'opd', cc: 'Comprehensive metabolic panel and lipid fractions for cardiovascular risk stratification', status: 'active', startedAt: daysAgo(0.2) },
      { idKey: 'ENC-PATH-007', ptMrn: 'MRN-2026-00025', doc: docSneha, deptCode: 'PATH', type: 'opd', cc: 'Hematologic evaluation: Platelet count and automated differential', status: 'active', startedAt: daysAgo(0.22) },
      { idKey: 'ENC-PATH-008', ptMrn: 'MRN-2026-00026', doc: docVikram, deptCode: 'PATH', type: 'opd', cc: 'Coagulation profile and urgent clinical chemistry analysis', status: 'active', startedAt: daysAgo(0.25) },

      // Front Desk Encounters (FRONT) — created by check-ins
      { idKey: 'ENC-FRONT-001', ptMrn: 'MRN-2026-00012', doc: docRajan, deptCode: 'FRONT', type: 'opd', cc: 'Cardiology outpatient consultation - Checked in at front desk', status: 'active', startedAt: daysAgo(0.08) },
      { idKey: 'ENC-FRONT-002', ptMrn: 'MRN-2026-00013', doc: docSneha, deptCode: 'FRONT', type: 'opd', cc: 'Internal medicine follow-up - Checked in at front desk', status: 'active', startedAt: daysAgo(0.1) },
      { idKey: 'ENC-FRONT-003', ptMrn: 'MRN-2026-00015', doc: docVikram, deptCode: 'FRONT', type: 'opd', cc: 'Cardiovascular screening - Checked in at front desk', status: 'active', startedAt: daysAgo(0.12) },
      { idKey: 'ENC-FRONT-004', ptMrn: 'MRN-2026-00018', doc: docAnjali, deptCode: 'FRONT', type: 'opd', cc: 'Routine clinical review - Checked in at front desk', status: 'active', startedAt: daysAgo(0.14) },
    ];

    // Add 35 Discharged / Historical Encounters across past 30 days
    for (let i = 27; i <= 50; i++) {
      const p = patientDefs[i - 1];
      const doc = doctors[(i - 27) % doctors.length];
      const dayOffset = (i % 25) + 1;
      encounterDefs.push({
        idKey: `ENC-HIST-${i}`,
        ptMrn: p.mrn,
        doc,
        deptCode: 'CARD',
        type: i % 3 === 0 ? 'follow_up' : 'opd',
        cc: `Routine outpatient medical evaluation for ${p.first} ${p.last}`,
        status: 'discharged',
        startedAt: daysAgo(dayOffset),
      });
    }

    const encounterMap: Record<string, any> = {};
    for (const e of encounterDefs) {
      const pt = patientMap[e.ptMrn];
      const deptId = deptMap[e.deptCode];
      
      let existing = await sql`
        SELECT id, status FROM encounters
        WHERE patient_id = ${pt.id} AND doctor_id = ${e.doc.id} AND department_id = ${deptId}
        LIMIT 1
      `;
      if (existing.length === 0) {
        const ins = await sql`
          INSERT INTO encounters (
            id, patient_id, doctor_id, department_id, encounter_type, chief_complaint, status,
            started_at, discharged_at, created_by, created_at, updated_at, version
          ) VALUES (
            gen_random_uuid(), ${pt.id}, ${e.doc.id}, ${deptId}, ${e.type}, ${e.cc}, ${e.status},
            ${e.startedAt}, ${e.status === 'discharged' ? daysAgo(1) : null}, ${e.doc.id}, ${e.startedAt}, now(), 1
          ) RETURNING id, status
        `;
        encounterMap[e.idKey] = { id: ins[0].id, patientId: pt.id, ...e };
      } else {
        encounterMap[e.idKey] = { id: existing[0].id, patientId: pt.id, ...e };
      }
    }
    console.log(`Encounters seeded/verified: ${Object.keys(encounterMap).length}`);

    // -----------------------------------------------------------------------
    // [5] Appointments (Today, Upcoming, Historical)
    // -----------------------------------------------------------------------
    console.log('\n--- [5] Appointments ---');
    const appointmentDefs: any[] = [];

    // Today's appointments for Front Desk Queue (FRONT) — Pooja Iyer visibility
    const frontTodayTimes = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
    const frontTodayStatuses = ['booked', 'booked', 'booked', 'booked', 'checked_in', 'checked_in', 'checked_in', 'checked_in', 'completed', 'completed', 'completed', 'completed'];

    for (let i = 0; i < 12; i++) {
      const pt = patientDefs[10 + i]; // MRN-11 to 22
      const doc = doctors[i % doctors.length];
      const status = frontTodayStatuses[i];
      appointmentDefs.push({
        idKey: `APPT-FRONT-TODAY-${i + 1}`,
        ptMrn: pt.mrn,
        doc,
        deptCode: 'FRONT',
        date: todayStr,
        time: frontTodayTimes[i],
        token: i + 1,
        status,
        encounterKey: status === 'checked_in' ? `ENC-FRONT-00${(i % 4) + 1}` : undefined,
      });
    }

    // Today's appointments for Cardiology Clinic (CARD) — Physician visibility
    const cardTodayTimes = ['09:15', '09:45', '10:15', '10:45', '11:15', '11:45', '14:15', '14:45', '15:15', '15:45', '16:15', '16:45', '17:00'];
    const cardTodayStatuses = ['checked_in', 'checked_in', 'checked_in', 'checked_in', 'checked_in', 'booked', 'booked', 'booked', 'booked', 'completed', 'completed', 'completed', 'completed'];

    for (let i = 0; i < 13; i++) {
      const pt = patientDefs[i]; // Showcase patients 1 to 10 + others
      const doc = doctors[i % doctors.length];
      const status = cardTodayStatuses[i];
      appointmentDefs.push({
        idKey: `APPT-CARD-TODAY-${i + 1}`,
        ptMrn: pt.mrn,
        doc,
        deptCode: 'CARD',
        date: todayStr,
        time: cardTodayTimes[i],
        token: i + 10,
        status,
        encounterKey: status === 'checked_in' ? `ENC-CARD-${String((i % 10) + 1).padStart(3, '0')}` : undefined,
      });
    }

    // Upcoming Appointments (next 1 to 5 days) across FRONT & CARD
    for (let d = 1; d <= 4; d++) {
      const futureDate = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
      for (let s = 0; s < 7; s++) {
        const ptIdx = (d * 7 + s) % patientDefs.length;
        const pt = patientDefs[ptIdx];
        const doc = doctors[s % doctors.length];
        const isFront = s % 2 === 0;
        appointmentDefs.push({
          idKey: `APPT-FUT-${d}-${s}`,
          ptMrn: pt.mrn,
          doc,
          deptCode: isFront ? 'FRONT' : 'CARD',
          date: futureDate,
          time: `1${s}:00`,
          token: s + 1,
          status: 'booked',
        });
      }
    }

    // Historical Appointments (past 1 to 20 days)
    for (let d = 1; d <= 4; d++) {
      const pastDate = new Date(Date.now() - d * 86400000 * 2).toISOString().slice(0, 10);
      for (let s = 0; s < 6; s++) {
        const ptIdx = (d * 6 + s + 20) % patientDefs.length;
        const pt = patientDefs[ptIdx];
        const doc = doctors[s % doctors.length];
        const isCancelled = s === 5;
        appointmentDefs.push({
          idKey: `APPT-PAST-${d}-${s}`,
          ptMrn: pt.mrn,
          doc,
          deptCode: s % 2 === 0 ? 'FRONT' : 'CARD',
          date: pastDate,
          time: `1${s}:30`,
          token: s + 20,
          status: isCancelled ? 'cancelled' : 'completed',
        });
      }
    }

    let createdAppts = 0;
    for (const a of appointmentDefs) {
      const pt = patientMap[a.ptMrn];
      const deptId = deptMap[a.deptCode];
      const encId = (a.encounterKey && encounterMap[a.encounterKey]?.id) || null;

      const existing = await sql`
        SELECT id FROM appointments
        WHERE doctor_id = ${a.doc.id} AND scheduled_date = ${a.date} AND scheduled_time = ${a.time}
        LIMIT 1
      `;
      if (existing.length === 0) {
        await sql`
          INSERT INTO appointments (
            id, patient_id, doctor_id, department_id, scheduled_date, scheduled_time, token_number,
            status, encounter_id, created_by, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), ${pt.id}, ${a.doc.id}, ${deptId}, ${a.date}, ${a.time}, ${a.token},
            ${a.status}, ${encId}, ${recPooja.id}, now(), now()
          )
        `;
        createdAppts++;
      }
    }
    console.log(`Appointments seeded/verified: total ${appointmentDefs.length} planned (${createdAppts} newly inserted)`);

    // -----------------------------------------------------------------------
    // [6] Clinical Records & Vitals (SOAP Notes, Progress Notes, Vitals)
    // -----------------------------------------------------------------------
    console.log('\n--- [6] Clinical Records & Vitals ---');

    const clinicalDefs = [
      {
        encKey: 'ENC-CARD-001',
        ptMrn: 'MRN-2026-00001',
        author: docRajan,
        type: 'soap',
        vitals: { bp_systolic: 168, bp_diastolic: 98, pulse_bpm: 104, resp_rate: 22, spo2_pct: 96, temperature_c: 36.8, weight_kg: 78.5, height_cm: 172 },
        content: {
          sections: [
            { heading: 'subjective', content: 'Patient presents with severe substernal chest pressure radiating to left arm and jaw for 3 hours, associated with diaphoresis and nausea. No relief with sublingual nitrates.' },
            { heading: 'objective', content: 'Diaphoretic, anxious. S1 S2 present, IV gallop noted. Bilateral basal fine crepitations. ECG reveals 2mm ST depression in leads V4-V6. Cardiac monitor attached.' },
            { heading: 'assessment', content: 'High-risk Acute Coronary Syndrome (Non-ST-Elevation Myocardial Infarction / Unstable Angina) with ongoing chest pain and hemodynamic compromise.' },
            { heading: 'plan', content: '1. STAT Troponin I and Basic Metabolic Panel.\n2. Dual Antiplatelet Therapy: Aspirin 325mg PO STAT + Clopidogrel 300mg PO STAT.\n3. Atorvastatin 80mg PO qhs.\n4. IV Heparin infusion protocol.\n5. Urgent cardiology intervention consultation for coronary angiography.' }
          ]
        }
      },
      {
        encKey: 'ENC-CARD-002',
        ptMrn: 'MRN-2026-00002',
        author: docSneha,
        type: 'soap',
        vitals: { bp_systolic: 138, bp_diastolic: 84, pulse_bpm: 76, resp_rate: 16, spo2_pct: 98, temperature_c: 36.6, weight_kg: 68.0, height_cm: 158 },
        content: {
          sections: [
            { heading: 'subjective', content: '6-month chronic diabetic review. Patient reports mild bilateral lower extremity tingling (distal neuropathy). No chest pain, palpitations, or orthopnea.' },
            { heading: 'objective', content: 'Alert, oriented. Fundoscopy shows mild background diabetic retinopathy. S1 S2 normal. Decreased vibration sense over bilateral halluces. Trace bilateral pedal edema.' },
            { heading: 'assessment', content: 'Type 2 Diabetes Mellitus with microvascular complications (early Diabetic Nephropathy and peripheral sensory neuropathy). Essential hypertension, controlled.' },
            { heading: 'plan', content: '1. Metformin maintained at 1000mg PO BID.\n2. Initiate Empagliflozin 10mg PO daily for renal and cardiovascular protection.\n3. Telmisartan 40mg PO daily.\n4. Comprehensive BMP and urinary albumin-to-creatinine ratio ordered.\n5. Clinical pharmacy review for renal dosing safety.' }
          ]
        }
      },
      {
        encKey: 'ENC-CARD-003',
        ptMrn: 'MRN-2026-00003',
        author: docVikram,
        type: 'soap',
        vitals: { bp_systolic: 102, bp_diastolic: 64, pulse_bpm: 98, resp_rate: 18, spo2_pct: 97, temperature_c: 36.7, weight_kg: 52.0, height_cm: 161 },
        content: {
          sections: [
            { heading: 'subjective', content: '29-year-old female complaining of progressive severe exhaustion, dizzy spells on standing, and exercise intolerance for the past 6 weeks. Heavy menstrual bleeding.' },
            { heading: 'objective', content: 'Marked paleness of palpebral conjunctiva and nail beds (koilonychia). Tachycardic at 98 bpm. Soft systolic hemic murmur at left sternal border.' },
            { heading: 'assessment', content: 'Severe symptomatic Microcytic Hypochromic Anemia, highly suggestive of severe Iron Deficiency Anemia secondary to menorrhagia.' },
            { heading: 'plan', content: '1. STAT Complete Blood Count and Iron Profile.\n2. Given extreme fatigue and impending decompensation, prepare for IV Ferric Carboxymaltose 500mg infusion.\n3. Gynecology referral for menorrhagia evaluation.\n4. Nursing observation and vital sign monitoring.' }
          ]
        }
      },
      {
        encKey: 'ENC-CARD-004',
        ptMrn: 'MRN-2026-00004',
        author: docAnjali,
        type: 'soap',
        vitals: { bp_systolic: 172, bp_diastolic: 104, pulse_bpm: 82, resp_rate: 16, spo2_pct: 99, temperature_c: 37.1, weight_kg: 84.0, height_cm: 175 },
        content: {
          sections: [
            { heading: 'subjective', content: 'Severe acute excruciating pain in right big toe that began overnight. Unable to bear weight. Also admits to poor adherence with antihypertensive medications.' },
            { heading: 'objective', content: 'Right first MTP joint is intensely erythematous, swollen, warm, and exquisitely tender to light touch. Blood pressure severely elevated at 172/104 mmHg.' },
            { heading: 'assessment', content: '1. Acute Podagra / Gouty Arthritis flare.\n2. Stage 2 Uncontrolled Essential Hypertension.' },
            { heading: 'plan', content: '1. Colchicine 0.5mg PO TID with NSAID for acute flare.\n2. Antihypertensive optimization: Amlodipine 10mg + Telmisartan 80mg daily.\n3. Serum uric acid and Renal function panel.\n4. Avoid starting allopurinol during acute attack.' }
          ]
        }
      },
      {
        encKey: 'ENC-CARD-005',
        ptMrn: 'MRN-2026-00005',
        author: docRahul,
        type: 'soap',
        vitals: { bp_systolic: 134, bp_diastolic: 82, pulse_bpm: 78, resp_rate: 20, spo2_pct: 94, temperature_c: 36.5, weight_kg: 71.0, height_cm: 155 },
        content: {
          sections: [
            { heading: 'subjective', content: 'Progressive shortness of breath on climbing single flight of stairs. Requires 3 pillows at night to sleep comfortably. Reports 2.5 kg weight gain over past week.' },
            { heading: 'objective', content: 'Elevated JVP (+4 cm above sternal angle). Bilateral bibasilar crackles. S3 gallop audible. 2+ bilateral pitting pretibial edema.' },
            { heading: 'assessment', content: 'Congestive Heart Failure (NYHA Functional Class II-III), clinical volume overload.' },
            { heading: 'plan', content: '1. Increase Furosemide to 40mg PO morning.\n2. Continue Sacubitril/Valsartan 49/51mg BID.\n3. Strict daily weight logging and fluid restriction to 1.5L/day.\n4. Serum electrolytes and creatinine check in 48 hours.' }
          ]
        }
      },
      // Additional progress notes & vitals
      {
        encKey: 'ENC-CARD-006',
        ptMrn: 'MRN-2026-00006',
        author: nursePriya,
        type: 'progress_note',
        content: { narrative: 'Nursing assessment at 11:30: Patient resting in bed. Temperature 38.9 C. IV fluid running at 100 mL/hr. Mild petechiae noted on lower forearms. Strict fluid intake/output chart initiated. Doctor Sharma informed of critical platelet count.' }
      },
      {
        encKey: 'ENC-CARD-001',
        ptMrn: 'MRN-2026-00001',
        author: nurseNeha,
        type: 'progress_note',
        content: { narrative: 'Bedside telemetry monitoring: Patient reports chest pain score reduced from 8/10 to 3/10 following sublingual nitrate and Aspirin administration. Continuous cardiac monitoring active. ST elevation absent.' }
      },
      {
        encKey: 'ENC-CARD-003',
        ptMrn: 'MRN-2026-00003',
        author: nursePriya,
        type: 'progress_note',
        content: { narrative: 'Patient in infusion room. Pre-medication vitals stable (BP 104/66, HR 92). IV cannula 20G secured in left forearm. Test dose of Ferric Carboxymaltose commenced with continuous anaphylaxis surveillance.' }
      }
    ];

    let createdRecords = 0;
    for (const c of clinicalDefs) {
      const enc = encounterMap[c.encKey];
      if (!enc) continue;
      
      const existing = await sql`
        SELECT id FROM clinical_records
        WHERE encounter_id = ${enc.id} AND record_type = ${c.type}
        LIMIT 1
      `;
      if (existing.length === 0) {
        await sql`
          INSERT INTO clinical_records (
            id, encounter_id, patient_id, record_type, content, vitals, status, signed_by, signed_at,
            version, created_by, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), ${enc.id}, ${enc.patientId}, ${c.type}, ${sql.json(c.content as any)},
            ${c.vitals ? sql.json(c.vitals as any) : null}, 'signed', ${c.author.id}, now(),
            1, ${c.author.id}, now(), now()
          )
        `;
        createdRecords++;
      }
    }
    console.log(`Clinical records seeded/verified: ${createdRecords} newly inserted`);

    // -----------------------------------------------------------------------
    // [7] Diagnostic Orders & Results (PATH & CARD)
    // -----------------------------------------------------------------------
    console.log('\n--- [7] Diagnostic Orders & Results ---');

    const orderDefs = [
      // Orders in Pathology Lab Department (PATH) — Lab Technician Workload
      { idKey: 'ORD-PATH-001', encKey: 'ENC-PATH-001', doc: docRajan, test: 'BMP', testName: 'Basic Metabolic Panel', priority: 'routine', status: 'ordered', indication: 'Fasting glucose and renal function surveillance' },
      { idKey: 'ORD-PATH-002', encKey: 'ENC-PATH-002', doc: docSneha, test: 'CBC', testName: 'Complete Blood Count with Platelets', priority: 'urgent', status: 'ordered', indication: 'Acute febrile illness and viral workup' },
      { idKey: 'ORD-PATH-003', encKey: 'ENC-PATH-003', doc: docVikram, test: 'TROP', testName: 'Troponin I (High Sensitivity)', priority: 'stat', status: 'ordered', indication: 'Rule out acute myocardial infarction' },
      { idKey: 'ORD-PATH-004', encKey: 'ENC-PATH-004', doc: docAnjali, test: 'BMP', testName: 'Renal & Electrolytes Panel', priority: 'routine', status: 'sample_collected', indication: 'Diuretic monitoring and serum potassium' },
      { idKey: 'ORD-PATH-005', encKey: 'ENC-PATH-005', doc: docRahul, test: 'LFT', testName: 'Liver Function Panel', priority: 'routine', status: 'sample_collected', indication: 'Statin baseline and transaminase check' },
      { idKey: 'ORD-PATH-006', encKey: 'ENC-PATH-006', doc: docRajan, test: 'CBC', testName: 'Complete Hemogram', priority: 'urgent', status: 'in_progress', indication: 'Leukocytosis and infection monitoring' },
      { idKey: 'ORD-PATH-007', encKey: 'ENC-PATH-007', doc: docSneha, test: 'BMP', testName: 'Basic Metabolic Panel', priority: 'routine', status: 'in_progress', indication: 'Electrolyte balance surveillance' },
      
      // Completed Orders with Verified Results in PATH
      {
        idKey: 'ORD-PATH-008', encKey: 'ENC-PATH-008', doc: docVikram, test: 'CBC', testName: 'Complete Blood Count', priority: 'stat', status: 'completed', indication: 'Emergency hematology check',
        results: [
          { parameterName: 'Hemoglobin', value: 14.2, unit: 'g/dL' },
          { parameterName: 'WBC', value: 7.4, unit: '10^3/uL' },
          { parameterName: 'Platelets', value: 245.0, unit: '10^3/uL' }
        ],
        isAbnormal: false, isCritical: false
      },
      {
        idKey: 'ORD-PATH-009', encKey: 'ENC-PATH-001', doc: docRajan, test: 'BMP', testName: 'Basic Metabolic Panel', priority: 'routine', status: 'completed', indication: 'Routine metabolic review',
        results: [
          { parameterName: 'Sodium', value: 139.0, unit: 'mEq/L' },
          { parameterName: 'Potassium', value: 4.3, unit: 'mEq/L' },
          { parameterName: 'Glucose', value: 94.0, unit: 'mg/dL' },
          { parameterName: 'Creatinine', value: 0.95, unit: 'mg/dL' }
        ],
        isAbnormal: false, isCritical: false
      },

      // Orders in Cardiology Department (CARD) — Showcase Clinical Patient Stories
      {
        idKey: 'ORD-CARD-001', encKey: 'ENC-CARD-001', doc: docRajan, test: 'TROP', testName: 'Troponin I (STAT)', priority: 'stat', status: 'completed', indication: 'Acute chest pain radiating to left arm — rule out NSTEMI',
        results: [{ parameterName: 'Troponin I', value: 2.45, unit: 'ng/mL' }],
        isAbnormal: true, isCritical: true, criticalRuleKey: 'TROP:Troponin I'
      },
      {
        idKey: 'ORD-CARD-002', encKey: 'ENC-CARD-003', doc: docVikram, test: 'CBC', testName: 'Complete Blood Count', priority: 'stat', status: 'completed', indication: 'Severe lethargy, extreme pallor, exertional dizziness',
        results: [
          { parameterName: 'Hemoglobin', value: 6.8, unit: 'g/dL' },
          { parameterName: 'WBC', value: 5.2, unit: '10^3/uL' },
          { parameterName: 'Platelets', value: 210.0, unit: '10^3/uL' }
        ],
        isAbnormal: true, isCritical: true, criticalRuleKey: 'CBC:Hemoglobin'
      },
      {
        idKey: 'ORD-CARD-003', encKey: 'ENC-CARD-006', doc: docRahul, test: 'CBC', testName: 'Platelet Count & Differential', priority: 'stat', status: 'completed', indication: 'Acute febrile illness, petechiae, viral thrombocytopenia',
        results: [
          { parameterName: 'Hemoglobin', value: 13.5, unit: 'g/dL' },
          { parameterName: 'WBC', value: 3.1, unit: '10^3/uL' },
          { parameterName: 'Platelets', value: 42.0, unit: '10^3/uL' }
        ],
        isAbnormal: true, isCritical: true, criticalRuleKey: 'CBC:Platelets'
      },
      {
        idKey: 'ORD-CARD-004', encKey: 'ENC-CARD-002', doc: docSneha, test: 'BMP', testName: 'Basic Metabolic Panel', priority: 'urgent', status: 'completed', indication: 'Type 2 Diabetes with microalbuminuria review',
        results: [
          { parameterName: 'Sodium', value: 137.0, unit: 'mEq/L' },
          { parameterName: 'Potassium', value: 4.8, unit: 'mEq/L' },
          { parameterName: 'Glucose', value: 215.0, unit: 'mg/dL' },
          { parameterName: 'Creatinine', value: 1.85, unit: 'mg/dL' }
        ],
        isAbnormal: true, isCritical: false
      },
      {
        idKey: 'ORD-CARD-005', encKey: 'ENC-CARD-010', doc: docAnjali, test: 'BMP', testName: 'Renal Function Panel', priority: 'routine', status: 'completed', indication: 'CKD Stage 3b management baseline',
        results: [
          { parameterName: 'Sodium', value: 138.0, unit: 'mEq/L' },
          { parameterName: 'Potassium', value: 5.2, unit: 'mEq/L' },
          { parameterName: 'Creatinine', value: 2.4, unit: 'mg/dL' },
          { parameterName: 'Glucose', value: 98.0, unit: 'mg/dL' }
        ],
        isAbnormal: true, isCritical: false
      },
      {
        idKey: 'ORD-CARD-006', encKey: 'ENC-CARD-008', doc: docRajan, test: 'TROP', testName: 'Troponin I Surveillance', priority: 'routine', status: 'completed', indication: 'Routine post-PCI stability verification',
        results: [{ parameterName: 'Troponin I', value: 0.01, unit: 'ng/mL' }],
        isAbnormal: false, isCritical: false
      }
    ];

    let createdOrders = 0;
    let createdResults = 0;

    for (const o of orderDefs) {
      const enc = encounterMap[o.encKey];
      if (!enc) continue;

      let existingOrder = await sql`
        SELECT id FROM diagnostic_orders
        WHERE encounter_id = ${enc.id} AND test_code = ${o.test}
        LIMIT 1
      `;
      let orderId: string;

      if (existingOrder.length === 0) {
        const ins = await sql`
          INSERT INTO diagnostic_orders (
            id, encounter_id, patient_id, ordering_doctor_id, test_code, test_name,
            clinical_indication, priority, status, collected_at, collected_by, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), ${enc.id}, ${enc.patientId}, ${o.doc.id}, ${o.test}, ${o.testName},
            ${o.indication}, ${o.priority}, ${o.status},
            ${o.status !== 'ordered' ? daysAgo(0.05) : null},
            ${o.status !== 'ordered' ? labKaran.id : null},
            ${daysAgo(0.1)}, now()
          ) RETURNING id
        `;
        orderId = ins[0].id;
        createdOrders++;
      } else {
        orderId = existingOrder[0].id;
      }

      if (o.results && o.status === 'completed') {
        const existingResult = await sql`SELECT id FROM diagnostic_results WHERE order_id = ${orderId} LIMIT 1`;
        if (existingResult.length === 0) {
          const critRuleId = o.criticalRuleKey ? ruleIdMap[o.criticalRuleKey] : null;
          await sql`
            INSERT INTO diagnostic_results (
              id, order_id, patient_id, test_code, result_values, is_abnormal, is_critical,
              critical_rule_id, status, entered_by, verified_by, verified_at, created_at, updated_at
            ) VALUES (
              gen_random_uuid(), ${orderId}, ${enc.patientId}, ${o.test}, ${sql.json(o.results as any)},
              ${o.isAbnormal}, ${o.isCritical}, ${critRuleId},
              ${o.isCritical ? 'critical_flagged' : 'verified'},
              ${labKaran.id}, ${labAnita.id}, now(), ${daysAgo(0.02)}, now()
            )
          `;
          createdResults++;
        }
      }
    }
    console.log(`Diagnostic orders: ${createdOrders} newly created, Results: ${createdResults} newly created`);

    // -----------------------------------------------------------------------
    // [8] Tasks Across All Roles
    // -----------------------------------------------------------------------
    console.log('\n--- [8] Tasks ---');

    const taskDefs = [
      // Suresh Joshi (Pharmacist) Tasks — Medication review & dispensing queue
      { to: pharmSuresh, by: docRajan, type: 'critical_alert', prio: 'critical', status: 'in_progress', title: 'High-risk Rx review: DAPT (Aspirin 325mg + Clopidogrel 300mg) for Acute Coronary Syndrome', desc: 'Verify GI bleeding history and proton pump inhibitor co-prescription for Patient Ramesh Verma.' },
      { to: pharmSuresh, by: docSneha, type: 'general', prio: 'high', status: 'in_progress', title: 'Renal dosing verification: Empagliflozin 10mg in Diabetic Nephropathy', desc: 'Confirm baseline eGFR > 30 mL/min for Patient Meenakshi Sundaram before initiating SGLT2 inhibitor.' },
      { to: pharmSuresh, by: docVikram, type: 'general', prio: 'high', status: 'in_progress', title: 'Dose & allergy verification: IV Ferric Carboxymaltose 500mg', desc: 'Verify iron deficit calculation and dilution parameters for Patient Ananya Mukherjee.' },
      { to: pharmSuresh, by: docAnjali, type: 'general', prio: 'medium', status: 'in_progress', title: 'Drug interaction screen: Colchicine + Amlodipine/Telmisartan', desc: 'Screen for CYP3A4 inhibitors and confirm safe concurrent dosing for Patient Vijay Raghavan.' },
      { to: pharmSuresh, by: docRajan, type: 'general', prio: 'low', status: 'completed', title: 'Outpatient dispensing: Atorvastatin 80mg + Metoprolol 50mg', desc: 'Medication dispensed and patient counseling completed on bedtime statin adherence.' },
      { to: pharmSuresh, by: docSneha, type: 'general', prio: 'low', status: 'completed', title: 'Outpatient dispensing: Levothyroxine 75mcg', desc: 'Dispensing verified. Advised empty-stomach morning administration with water.' },

      // Priya Verma & Neha Gupta (Nurses) Tasks — Ward Care & Observations
      { to: nursePriya, by: docRajan, type: 'critical_alert', prio: 'critical', status: 'in_progress', title: 'Hourly vital signs and cardiac rhythm surveillance', desc: 'Continuous telemetry observation for chest pain recurrence in Patient Ramesh Verma.' },
      { to: nursePriya, by: docVikram, type: 'general', prio: 'high', status: 'in_progress', title: 'Administer IV Ferric Carboxymaltose infusion', desc: 'Infuse over 15 minutes with emergency anaphylaxis kit at bedside for Patient Ananya Mukherjee.' },
      { to: nursePriya, by: docAnjali, type: 'general', prio: 'medium', status: 'completed', title: 'Bedside diagnostic specimen collection for serum uric acid', desc: 'Venipuncture performed without complication. Specimen dispatched to pathology core lab.' },

      { to: nurseNeha, by: docRahul, type: 'critical_alert', prio: 'critical', status: 'in_progress', title: 'Strict intake/output fluid balance monitoring for Dengue fever', desc: 'Assess hematocrit and monitor for capillary leak signs in Patient Harishankar Pandey.' },
      { to: nurseNeha, by: docVikram, type: 'general', prio: 'high', status: 'in_progress', title: 'Nebulizer therapy: Salbutamol + Ipratropium', desc: 'Administer back-to-back bronchodilator nebulization and re-check peak expiratory flow for Patient Pooja Nambiar.' },
      { to: nurseNeha, by: docSneha, type: 'general', prio: 'medium', status: 'completed', title: 'Post-consultation diabetic foot care education', desc: 'Demonstrated inspection of pressure areas and advised on diabetic footwear.' },

      // Karan Malhotra & Anita Rao (Lab Technicians) Tasks
      { to: labKaran, by: docRahul, type: 'critical_alert', prio: 'critical', status: 'in_progress', title: 'Manual peripheral smear differential for thrombocytopenia', desc: 'Rule out platelet clumping and evaluate for blast cells in sample for Patient Harishankar Pandey.' },
      { to: labKaran, by: adminDeepak, type: 'general', prio: 'medium', status: 'completed', title: 'Daily automated calibration: Core biochemistry analyzer bench 1', desc: 'Calibration curve verified within 2 standard deviations across all electrolytes.' },

      { to: labAnita, by: docVikram, type: 'critical_alert', prio: 'critical', status: 'in_progress', title: 'Dual verification: STAT Troponin I assay (2.45 ng/mL)', desc: 'Run control repeat and communicate panic value to attending cardiology physician.' },
      { to: labAnita, by: adminDeepak, type: 'general', prio: 'medium', status: 'completed', title: 'Inventory audit: Reagents for automated hematology analyzer', desc: 'Reagent stock logged. All control lots within valid expiry dates.' },

      // Physicians Tasks
      { to: docRajan, by: labAnita, type: 'critical_alert', prio: 'critical', status: 'created', title: 'Acknowledge Critical Panic Result: Troponin I 2.45 ng/mL', desc: 'STAT result released for Patient Ramesh Verma. Immediate clinical intervention required.' },
      { to: docVikram, by: labAnita, type: 'critical_alert', prio: 'critical', status: 'created', title: 'Acknowledge Critical Panic Result: Hemoglobin 6.8 g/dL', desc: 'Severe anemia alert released for Patient Ananya Mukherjee. Transfusion/iron protocol review needed.' },
      { to: docRahul, by: labKaran, type: 'critical_alert', prio: 'critical', status: 'created', title: 'Acknowledge Critical Panic Result: Platelets 42,000/uL', desc: 'Critical thrombocytopenia flagged for Patient Harishankar Pandey.' },
      { to: docSneha, by: nursePriya, type: 'general', prio: 'medium', status: 'in_progress', title: 'Sign outpatient discharge summary for hypertensive review', desc: 'Review completed clinical note and finalize electronic signature.' },

      // Pooja Iyer (Receptionist) Tasks
      { to: recPooja, by: docRajan, type: 'general', prio: 'medium', status: 'in_progress', title: 'Contact patient regarding post-PCI follow-up slot confirmation', desc: 'Confirm cardiology consultation slot for Arun Saxena.' },
      { to: recPooja, by: adminDeepak, type: 'general', prio: 'low', status: 'completed', title: 'Verify Aadhaar identity records for morning clinic cohort', desc: 'Identity verification completed for all registered patients.' }
    ];

    let createdTasks = 0;
    for (const t of taskDefs) {
      const existing = await sql`
        SELECT id FROM tasks WHERE assigned_to = ${t.to.id} AND title = ${t.title} LIMIT 1
      `;
      if (existing.length === 0) {
        await sql`
          INSERT INTO tasks (
            id, task_type, title, description, assigned_to, assigned_by, priority, status,
            due_at, completed_at, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), ${t.type}, ${t.title}, ${t.desc}, ${t.to.id}, ${t.by.id}, ${t.prio}, ${t.status},
            ${new Date(Date.now() + 86400000)}, ${t.status === 'completed' ? daysAgo(0.1) : null}, ${daysAgo(0.2)}, now()
          )
        `;
        createdTasks++;
      }
    }
    console.log(`Tasks seeded/verified: ${createdTasks} newly inserted`);

    // -----------------------------------------------------------------------
    // [9] Notifications
    // -----------------------------------------------------------------------
    console.log('\n--- [9] Notifications ---');

    const notificationDefs = [
      { to: docRajan, type: 'critical_lab_alert', prio: 'critical', status: 'dispatched', title: 'CRITICAL LAB ALERT: Troponin I 2.45 ng/mL', body: 'Patient Ramesh Verma (MRN-2026-00001) has a critical cardiac biomarker flag. Value exceeds panic high threshold (2.0 ng/mL).' },
      { to: nursePriya, type: 'critical_lab_alert', prio: 'critical', status: 'delivered', title: 'CRITICAL VALUE NOTIFICATION: Troponin I 2.45 ng/mL', body: 'Critical value reported for ward patient Ramesh Verma. Notify attending doctor immediately.' },
      { to: docVikram, type: 'critical_lab_alert', prio: 'critical', status: 'dispatched', title: 'CRITICAL LAB ALERT: Hemoglobin 6.8 g/dL', body: 'Patient Ananya Mukherjee (MRN-2026-00003) has a critical low hemoglobin flag (threshold < 7.0 g/dL).' },
      { to: docRahul, type: 'critical_lab_alert', prio: 'critical', status: 'dispatched', title: 'CRITICAL LAB ALERT: Platelets 42,000/uL', body: 'Patient Harishankar Pandey (MRN-2026-00006) has a critical low platelet count (threshold < 50,000/uL).' },

      { to: pharmSuresh, type: 'task_assignment', prio: 'urgent', status: 'delivered', title: 'Prescription Review Assigned: Acute Coronary Syndrome', body: 'High-risk dual antiplatelet therapy prescription requires urgent clinical pharmacist sign-off.' },
      { to: pharmSuresh, type: 'task_assignment', prio: 'normal', status: 'acknowledged', title: 'Task Completed: Formulary Review', body: 'Routine formulary review completed and archived.' },

      { to: nursePriya, type: 'task_assignment', prio: 'urgent', status: 'delivered', title: 'Care Task Assigned: Bedside Specimen Collection', body: 'STAT blood draw requested for Cardiology floor consult.' },
      { to: nurseNeha, type: 'task_assignment', prio: 'urgent', status: 'delivered', title: 'Care Task Assigned: Nebulizer Therapy', body: 'Administer bronchodilator treatment for Patient Pooja Nambiar.' },

      { to: secAmit, type: 'break_glass_alert', prio: 'urgent', status: 'dispatched', title: 'Break-glass Emergency Override Activated', body: 'Dr. Vikram Singh activated an emergency override session for Patient Pooja Nambiar (Reason: emergency_care).' },
      { to: secAmit, type: 'system_alert', prio: 'normal', status: 'acknowledged', title: 'Audit Ledger Hash Integrity Verified', body: 'Automated cryptographic verification confirmed 100% hash chain continuity.' },

      { to: adminDeepak, type: 'system_alert', prio: 'normal', status: 'delivered', title: 'Hospital Operational Summary Ready', body: 'Shift clinical throughput report compiled: 60 encounters, 80 scheduled appointments.' },
      { to: recPooja, type: 'task_assignment', prio: 'normal', status: 'delivered', title: 'Front Desk Task: Appointment Confirmation', body: 'Patient follow-up confirmation call scheduled.' }
    ];

    let createdNotifs = 0;
    for (const n of notificationDefs) {
      const existing = await sql`
        SELECT id FROM notifications WHERE recipient_id = ${n.to.id} AND title = ${n.title} LIMIT 1
      `;
      if (existing.length === 0) {
        await sql`
          INSERT INTO notifications (
            id, recipient_id, notification_type, title, body, priority, status, created_at
          ) VALUES (
            gen_random_uuid(), ${n.to.id}, ${n.type}, ${n.title}, ${n.body}, ${n.prio}, ${n.status}, ${daysAgo(0.1)}
          )
        `;
        createdNotifs++;
      }
    }
    console.log(`Notifications seeded/verified: ${createdNotifs} newly inserted`);

    // -----------------------------------------------------------------------
    // [10] Break-Glass Emergency Sessions
    // -----------------------------------------------------------------------
    console.log('\n--- [10] Break-Glass Sessions ---');

    // 1 Active Session: Dr. Vikram Singh for Pooja Nambiar
    const ptPooja = patientMap['MRN-2026-00009'];
    const activeBgCheck = await sql`
      SELECT id FROM break_glass_sessions
      WHERE staff_id = ${docVikram.id} AND patient_id = ${ptPooja.id} AND is_active = TRUE
      LIMIT 1
    `;
    if (activeBgCheck.length === 0) {
      await sql`
        INSERT INTO break_glass_sessions (
          id, staff_id, patient_id, reason, justification, granted_scope, is_active,
          activated_at, expires_at
        ) VALUES (
          gen_random_uuid(), ${docVikram.id}, ${ptPooja.id}, 'emergency_care',
          'Patient presenting in acute severe respiratory distress with hemodynamic instability (RR 28, SpO2 90%). Immediate unassigned chart access required for prior intubation and corticosteroid treatment history.',
          '{}', TRUE, ${daysAgo(0.02)}, ${new Date(Date.now() + 7200000)}
        )
      `;
      console.log('  + Created active emergency break-glass session for Dr. Vikram Singh');
    }

    // 1 Historical Reviewed Session: Dr. Rajan Mehta for Ramesh Verma
    const ptRamesh = patientMap['MRN-2026-00001'];
    const histBgCheck = await sql`
      SELECT id FROM break_glass_sessions
      WHERE staff_id = ${docRajan.id} AND patient_id = ${ptRamesh.id} AND is_active = FALSE
      LIMIT 1
    `;
    if (histBgCheck.length === 0) {
      await sql`
        INSERT INTO break_glass_sessions (
          id, staff_id, patient_id, reason, justification, granted_scope, is_active,
          activated_at, expires_at, deactivated_at, reviewed_at, reviewed_by, review_notes
        ) VALUES (
          gen_random_uuid(), ${docRajan.id}, ${ptRamesh.id}, 'emergency_care',
          'Emergency cardiac triage override: Patient presented with crushing substernal chest pain and diaphoresis. Prior cardiology interventions required for urgent cath lab evaluation.',
          '{}', FALSE, ${daysAgo(1)}, ${daysAgo(0.9)}, ${daysAgo(0.9)}, ${daysAgo(0.85)}, ${secAmit.id},
          'Post-activation review completed. Verified emergency clinical indication; override conforms to hospital clinical emergency policy.'
        )
      `;
      console.log('  + Created reviewed historical break-glass session for Dr. Rajan Mehta');
    }

    // -----------------------------------------------------------------------
    // [11] Cryptographic Audit Events with Valid SHA-256 Hash Chain
    // -----------------------------------------------------------------------
    console.log('\n--- [11] Audit Events ---');
    const existingAuditCount = await sql`SELECT count(*)::int as count FROM audit_events`;
    
    if (existingAuditCount[0].count === 0) {
      console.log('Bootstrapping unbroken cryptographic audit hash chain...');

      const auditEventDefs = [
        { type: 'PATIENT_REGISTERED', actor: recPooja, role: 'receptionist', dept: 'FRONT', targetType: 'PATIENT', pt: ptRamesh, detail: { mrn: 'MRN-2026-00001' } },
        { type: 'PATIENT_IDENTITY_VERIFIED', actor: recPooja, role: 'receptionist', dept: 'FRONT', targetType: 'IDENTITY', pt: ptRamesh, detail: { documentType: 'aadhaar' } },
        { type: 'APPOINTMENT_BOOKED', actor: recPooja, role: 'receptionist', dept: 'FRONT', targetType: 'APPOINTMENT', pt: ptRamesh, detail: { doctor: 'Dr. Rajan Mehta', slot: '09:15' } },
        { type: 'APPOINTMENT_CHECKED_IN', actor: recPooja, role: 'receptionist', dept: 'FRONT', targetType: 'APPOINTMENT', pt: ptRamesh, detail: { token: 10 } },
        { type: 'ENCOUNTER_CREATED', actor: docRajan, role: 'physician', dept: 'CARD', targetType: 'ENCOUNTER', pt: ptRamesh, detail: { encounterType: 'opd' } },
        { type: 'CLINICAL_RECORD_CREATED', actor: docRajan, role: 'physician', dept: 'CARD', targetType: 'CLINICAL_RECORD', pt: ptRamesh, detail: { recordType: 'soap' } },
        { type: 'CLINICAL_RECORD_SIGNED', actor: docRajan, role: 'physician', dept: 'CARD', targetType: 'CLINICAL_RECORD', pt: ptRamesh, detail: { recordType: 'soap', signedBy: 'Dr. Rajan Mehta' } },
        { type: 'DIAGNOSTIC_ORDER_CREATED', actor: docRajan, role: 'physician', dept: 'CARD', targetType: 'DIAGNOSTIC_ORDER', pt: ptRamesh, detail: { testCode: 'TROP', priority: 'stat' } },
        { type: 'SAMPLE_COLLECTED', actor: labKaran, role: 'lab_technician', dept: 'PATH', targetType: 'DIAGNOSTIC_ORDER', pt: ptRamesh, detail: { testCode: 'TROP' } },
        { type: 'DIAGNOSTIC_RESULT_ENTERED', actor: labKaran, role: 'lab_technician', dept: 'PATH', targetType: 'DIAGNOSTIC_RESULT', pt: ptRamesh, detail: { isCritical: true, parameter: 'Troponin I', value: 2.45 } },
        { type: 'DIAGNOSTIC_RESULT_VERIFIED', actor: labAnita, role: 'lab_technician', dept: 'PATH', targetType: 'DIAGNOSTIC_RESULT', pt: ptRamesh, detail: { verifiedBy: 'Anita Rao' } },
        { type: 'CRITICAL_NOTIFICATION_DISPATCHED', actor: labAnita, role: 'lab_technician', dept: 'PATH', targetType: 'NOTIFICATION', pt: ptRamesh, detail: { priority: 'critical', recipient: 'Dr. Rajan Mehta' } },
        { type: 'TASK_CREATED', actor: docRajan, role: 'physician', dept: 'CARD', targetType: 'TASK', pt: ptRamesh, detail: { assignedTo: 'Suresh Joshi', title: 'High-risk Rx review' } },
        { type: 'MEDICATION_DISPENSED', actor: pharmSuresh, role: 'pharmacist', dept: 'PHARM', targetType: 'TASK', pt: ptRamesh, detail: { medication: 'Atorvastatin 80mg' } },
        { type: 'BREAK_GLASS_ACTIVATED', actor: docVikram, role: 'physician', dept: 'CARD', targetType: 'BREAK_GLASS_SESSION', pt: ptPooja, detail: { reason: 'emergency_care' } },
        { type: 'BREAK_GLASS_REVIEWED', actor: secAmit, role: 'security_admin', dept: 'SEC', targetType: 'BREAK_GLASS_SESSION', pt: ptRamesh, detail: { reviewer: 'Amit Yadav', decision: 'CONFIRMED' } }
      ];

      let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';

      for (const ev of auditEventDefs) {
        const correlationId = randomUUID();
        const payloadString = JSON.stringify({
          eventType: ev.type,
          actorId: ev.actor.id,
          actorRole: ev.role,
          actorDepartment: deptMap[ev.dept],
          targetType: ev.targetType,
          targetId: null,
          patientId: ev.pt.id,
          actionDetail: jsonbCanonical(ev.detail) || null,
          justification: null,
          ipAddress: null,
          correlationId,
        });

        const recordHash = createHash('sha256')
          .update(prevHash + payloadString)
          .digest('hex');

        await sql`
          INSERT INTO audit_events (
            id, event_type, actor_id, actor_role, actor_department, target_type, target_id,
            patient_id, action_detail, justification, correlation_id, previous_hash, record_hash, created_at
          ) VALUES (
            gen_random_uuid(), ${ev.type}, ${ev.actor.id}, ${ev.role}, ${deptMap[ev.dept]}, ${ev.targetType},
            null, ${ev.pt.id}, ${sql.json(ev.detail as any)}, null, ${correlationId},
            ${prevHash}, ${recordHash}, ${daysAgo(0.05)}
          )
        `;

        prevHash = recordHash;
      }
      console.log(`Cryptographic audit events created: ${auditEventDefs.length} events chained.`);
    } else {
      console.log(`Audit events already present: ${existingAuditCount[0].count} events.`);
    }

    // -----------------------------------------------------------------------
    // [12] Summary Verification
    // -----------------------------------------------------------------------
    console.log('\n' + '='.repeat(65));
    console.log('MEDORA PRODUCTION DATA VERIFICATION SUMMARY');
    console.log('='.repeat(65));

    const counts = await sql`
      SELECT
        (SELECT count(*) FROM departments) as departments,
        (SELECT count(*) FROM staff) as staff,
        (SELECT count(*) FROM patients) as patients,
        (SELECT count(*) FROM identities) as identities,
        (SELECT count(*) FROM appointments) as appointments,
        (SELECT count(*) FROM encounters) as encounters,
        (SELECT count(*) FROM clinical_records) as clinical_records,
        (SELECT count(*) FROM critical_value_rules) as critical_rules,
        (SELECT count(*) FROM diagnostic_orders) as diagnostic_orders,
        (SELECT count(*) FROM diagnostic_results) as diagnostic_results,
        (SELECT count(*) FROM tasks) as tasks,
        (SELECT count(*) FROM notifications) as notifications,
        (SELECT count(*) FROM break_glass_sessions) as break_glass_sessions,
        (SELECT count(*) FROM audit_events) as audit_events
    `;

    console.table(counts[0]);
    console.log('=== Seed Execution Complete ===\n');

  } catch (err) {
    console.error('CRITICAL SEED ERROR:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
