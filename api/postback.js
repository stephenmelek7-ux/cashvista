// =============================================
// CPX RESEARCH POSTBACK HANDLER
// =============================================
// This file handles survey completion callbacks from CPX Research
// It automatically credits users' balances when they complete surveys
// =============================================

const SUPABASE_URL = 'https://jblfciwnddqokyiuzmgd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nge3ZsQ3TmI54oR2ySSb7w_Tj322Hke';

// =============================================
// MAIN POSTBACK HANDLER
// =============================================
export default async function handler(req, res) {
    // Only allow GET requests (CPX uses GET for postbacks)
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed. Use GET.' });
    }

    try {
        // Get all parameters from CPX
        const {
            status,
            trans_id,
            user_id,
            amount_local,
            amount_usd,
            offer_id,
            hash,
            ip_click,
            sub_id,
            sub_id_2,
            type
        } = req.query;

        console.log('📥 Postback received:', {
            status,
            trans_id,
            user_id,
            amount_local,
            amount_usd,
            offer_id,
            type
        });

        // =============================================
        // VALIDATE REQUIRED FIELDS
        // =============================================
        if (!user_id) {
            console.error('❌ Missing user_id');
            return res.status(400).json({ 
                error: 'Missing user_id parameter' 
            });
        }

        if (!trans_id) {
            console.error('❌ Missing trans_id');
            return res.status(400).json({ 
                error: 'Missing trans_id parameter' 
            });
        }

        // =============================================
        // HANDLE DIFFERENT EVENT TYPES
        // =============================================
        // status = 1 means survey completed
        // status = 2 means survey cancelled/fraud
        // status = "screenout" means user didn't qualify
        // status = "bonus" means user rated the survey

        const statusCode = parseInt(status) || 0;

        // Case 1: Survey Completed
        if (statusCode === 1 || status === '1') {
            return await handleCompletion(req, res);
        }

        // Case 2: Survey Cancelled / Fraud
        if (statusCode === 2 || status === '2') {
            return await handleCancellation(req, res);
        }

        // Case 3: Screen Out (user didn't qualify)
        if (status === 'screenout') {
            return await handleScreenOut(req, res);
        }

        // Case 4: Bonus / Rating
        if (status === 'bonus') {
            return await handleBonus(req, res);
        }

        // Unknown status
        console.log('⚠️ Unknown status received:', status);
        return res.status(200).json({ 
            message: 'Received unknown status',
            status: status 
        });

    } catch (error) {
        console.error('❌ Postback handler error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

// =============================================
// HANDLE SURVEY COMPLETION
// =============================================
async function handleCompletion(req, res) {
    const { user_id, amount_local, trans_id, offer_id, type } = req.query;

    try {
        console.log('✅ Processing survey completion for user:', user_id);

        // Step 1: Get the user from Supabase
        const userResponse = await fetch(
            SUPABASE_URL + '/rest/v1/users?email=eq.' + encodeURIComponent(user_id),
            {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                }
            }
        );

        if (!userResponse.ok) {
            console.error('❌ Failed to fetch user:', user_id);
            return res.status(404).json({ 
                error: 'User not found',
                user_id: user_id 
            });
        }

        const users = await userResponse.json();

        if (!users || users.length === 0) {
            console.error('❌ User not found in database:', user_id);
            return res.status(404).json({ 
                error: 'User not found in database',
                user_id: user_id 
            });
        }

        const user = users[0];
        const amountToCredit = parseInt(amount_local) || 0;

        if (amountToCredit <= 0) {
            console.log('⚠️ Amount is 0 or negative, skipping credit');
            return res.status(200).json({ 
                message: 'No amount to credit',
                user_id: user_id,
                amount: amountToCredit
            });
        }

        console.log('💰 Crediting user:', user_id, 'with', amountToCredit, 'coins');

        // Step 2: Update user's balance in Supabase
        const currentBalance = user.balance || 0;
        const newBalance = currentBalance + amountToCredit;

        const updateResponse = await fetch(
            SUPABASE_URL + '/rest/v1/users?email=eq.' + encodeURIComponent(user_id),
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                },
                body: JSON.stringify({
                    balance: newBalance
                })
            }
        );

        if (!updateResponse.ok) {
            console.error('❌ Failed to update user balance');
            return res.status(500).json({ 
                error: 'Failed to update user balance' 
            });
        }

        // Step 3: Log the transaction in activity table
        const activityData = {
            user_name: user_id,
            action: '✅ Survey completed - Earned ' + amountToCredit + ' coins (CPX)',
            amount: amountToCredit,
            date: new Date().toISOString()
        };

        await fetch(
            SUPABASE_URL + '/rest/v1/activity',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                },
                body: JSON.stringify(activityData)
            }
        );

        // Step 4: Log the transaction in transactions table (optional)
        const transactionData = {
            user_email: user_id,
            amount: amountToCredit,
            type: 'survey_completion',
            description: 'CPX Survey Completion - ' + (offer_id || 'N/A'),
            trans_id: trans_id,
            status: 'completed',
            created_at: new Date().toISOString()
        };

        await fetch(
            SUPABASE_URL + '/rest/v1/wallet_transactions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                },
                body: JSON.stringify(transactionData)
            }
        ).catch(() => {
            // If wallet_transactions table doesn't exist, ignore
            console.log('Note: wallet_transactions table not found, skipping');
        });

        console.log('✅ Successfully credited', user_id, 'with', amountToCredit, 'coins');

        // Step 5: Return success to CPX
        return res.status(200).json({
            success: true,
            message: 'User credited successfully',
            user_id: user_id,
            amount: amountToCredit,
            new_balance: newBalance
        });

    } catch (error) {
        console.error('❌ Error in handleCompletion:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// =============================================
// HANDLE SURVEY CANCELLATION / FRAUD
// =============================================
async function handleCancellation(req, res) {
    const { user_id, amount_local, trans_id } = req.query;

    try {
        console.log('⚠️ Processing survey cancellation for user:', user_id);

        // Reverse the credit if the user was previously credited
        const amountToDeduct = parseInt(amount_local) || 0;

        if (amountToDeduct <= 0) {
            return res.status(200).json({
                message: 'No amount to deduct',
                user_id: user_id
            });
        }

        // Get current user balance
        const userResponse = await fetch(
            SUPABASE_URL + '/rest/v1/users?email=eq.' + encodeURIComponent(user_id),
            {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                }
            }
        );

        if (!userResponse.ok) {
            return res.status(404).json({ error: 'User not found' });
        }

        const users = await userResponse.json();

        if (!users || users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];
        const currentBalance = user.balance || 0;
        const newBalance = Math.max(0, currentBalance - amountToDeduct);

        // Update user balance
        await fetch(
            SUPABASE_URL + '/rest/v1/users?email=eq.' + encodeURIComponent(user_id),
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                },
                body: JSON.stringify({
                    balance: newBalance
                })
            }
        );

        // Log cancellation
        const activityData = {
            user_name: user_id,
            action: '❌ Survey cancelled/fraud - Deducted ' + amountToDeduct + ' coins (CPX)',
            amount: -amountToDeduct,
            date: new Date().toISOString()
        };

        await fetch(
            SUPABASE_URL + '/rest/v1/activity',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                },
                body: JSON.stringify(activityData)
            }
        );

        console.log('✅ Cancellation processed for', user_id);

        return res.status(200).json({
            success: true,
            message: 'Cancellation processed',
            user_id: user_id,
            amount_deducted: amountToDeduct
        });

    } catch (error) {
        console.error('❌ Error in handleCancellation:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// =============================================
// HANDLE SCREEN OUT
// =============================================
async function handleScreenOut(req, res) {
    const { user_id } = req.query;

    try {
        console.log('📋 User screened out:', user_id);

        // Log screen out (no balance change)
        const activityData = {
            user_name: user_id || 'Unknown',
            action: '📋 Survey screen out (CPX)',
            amount: 0,
            date: new Date().toISOString()
        };

        await fetch(
            SUPABASE_URL + '/rest/v1/activity',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                },
                body: JSON.stringify(activityData)
            }
        ).catch(() => {});

        return res.status(200).json({
            success: true,
            message: 'Screen out logged',
            user_id: user_id
        });

    } catch (error) {
        console.error('❌ Error in handleScreenOut:', error);
        return res.status(200).json({
            success: true,
            message: 'Screen out processed (with error)',
            error: error.message
        });
    }
}

// =============================================
// HANDLE BONUS / RATING
// =============================================
async function handleBonus(req, res) {
    const { user_id, amount_local } = req.query;

    try {
        console.log('⭐ Bonus received for user:', user_id);

        const amountToCredit = parseInt(amount_local) || 0;

        if (amountToCredit <= 0) {
            return res.status(200).json({
                message: 'No bonus amount',
                user_id: user_id
            });
        }

        // Get current user balance
        const userResponse = await fetch(
            SUPABASE_URL + '/rest/v1/users?email=eq.' + encodeURIComponent(user_id),
            {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                }
            }
        );

        if (!userResponse.ok) {
            return res.status(404).json({ error: 'User not found' });
        }

        const users = await userResponse.json();

        if (!users || users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];
        const currentBalance = user.balance || 0;
        const newBalance = currentBalance + amountToCredit;

        // Update user balance
        await fetch(
            SUPABASE_URL + '/rest/v1/users?email=eq.' + encodeURIComponent(user_id),
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                },
                body: JSON.stringify({
                    balance: newBalance
                })
            }
        );

        // Log bonus
        const activityData = {
            user_name: user_id,
            action: '⭐ Survey rating bonus - Earned ' + amountToCredit + ' coins (CPX)',
            amount: amountToCredit,
            date: new Date().toISOString()
        };

        await fetch(
            SUPABASE_URL + '/rest/v1/activity',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY
                },
                body: JSON.stringify(activityData)
            }
        );

        console.log('✅ Bonus credited to', user_id, amountToCredit, 'coins');

        return res.status(200).json({
            success: true,
            message: 'Bonus credited',
            user_id: user_id,
            amount: amountToCredit
        });

    } catch (error) {
        console.error('❌ Error in handleBonus:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
