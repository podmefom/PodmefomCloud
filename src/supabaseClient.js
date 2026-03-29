const supabaseUrl = 'https://lnkpwtktcyitckrwlsqw.supabase.co';
const supabaseAnonKey = 'sb_publishable_MYIFaWKXlNhXa2vPUlLF1g_82uST1xG';

export const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);