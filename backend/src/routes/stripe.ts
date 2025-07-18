import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Create subscription
router.post('/create-subscription', async (req: Request, res: Response) => {
  try {
    const { customerId, priceId, paymentMethodId } = req.body;

    if (!customerId || !priceId || !paymentMethodId) {
      return res.status(400).json({ 
        error: 'Missing required fields: customerId, priceId, paymentMethodId' 
      });
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    // Update customer membership status in database
    await db.query(
      'UPDATE customers SET membership_status = $1, stripe_subscription_id = $2 WHERE stripe_customer_id = $3',
      ['active', subscription.id, customerId]
    );

    logger.info('Subscription created:', { 
      customerId, 
      subscriptionId: subscription.id 
    });

    return res.json({
      subscriptionId: subscription.id,
      clientSecret: (subscription.latest_invoice as any).payment_intent.client_secret,
    });

  } catch (error) {
    logger.error('Error creating subscription:', error);
    return res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Cancel subscription
router.post('/cancel-subscription', async (req: Request, res: Response) => {
  try {
    const { subscriptionId, customerId } = req.body;

    if (!subscriptionId || !customerId) {
      return res.status(400).json({ 
        error: 'Missing required fields: subscriptionId, customerId' 
      });
    }

    // Cancel subscription in Stripe
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // Update customer membership status in database
    await db.query(
      'UPDATE customers SET membership_status = $1 WHERE stripe_customer_id = $2',
      ['inactive', customerId]
    );

    logger.info('Subscription cancelled:', { subscriptionId, customerId });

    return res.json({ 
      message: 'Subscription cancelled successfully',
      subscriptionId 
    });

  } catch (error) {
    logger.error('Error cancelling subscription:', error);
    return res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Stripe webhook handler
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    logger.error('Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      
      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error) {
    logger.error('Error processing webhook:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Webhook handlers
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  await db.query(
    'UPDATE customers SET membership_status = $1 WHERE stripe_customer_id = $2',
    ['active', subscription.customer as string]
  );
  logger.info('Subscription created webhook processed:', { subscriptionId: subscription.id });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const status = subscription.status === 'active' ? 'active' : 'inactive';
  await db.query(
    'UPDATE customers SET membership_status = $1 WHERE stripe_customer_id = $2',
    [status, subscription.customer as string]
  );
  logger.info('Subscription updated webhook processed:', { subscriptionId: subscription.id });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await db.query(
    'UPDATE customers SET membership_status = $1 WHERE stripe_customer_id = $2',
    ['inactive', subscription.customer as string]
  );
  logger.info('Subscription deleted webhook processed:', { subscriptionId: subscription.id });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  logger.info('Payment succeeded:', { invoiceId: invoice.id });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  await db.query(
    'UPDATE customers SET membership_status = $1 WHERE stripe_customer_id = $2',
    ['inactive', invoice.customer as string]
  );
  logger.info('Payment failed webhook processed:', { invoiceId: invoice.id });
}

export default router; 