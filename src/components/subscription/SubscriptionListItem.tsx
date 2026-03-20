import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Subscription } from '@/src/types';
import { COLORS } from '@/src/constants/colors';
import { BILLING_CYCLE_LABELS, UPCOMING_RENEWAL_DAYS } from '@/src/constants/app';
import { formatAmount } from '@/src/utils/amountUtils';
import { formatShortDate, isWithinNextDays, isOverdueRenewal } from '@/src/utils/dateUtils';
import { StatusBadge } from '@/src/components/ui/StatusBadge';
import { getServiceLogoUrl } from '@/src/constants/serviceLogos';

/** 頭文字アバター: 英字は大文字化、日本語・記号はそのまま1文字 */
function getAvatarChar(name: string): string {
  const char = name.charAt(0);
  return /[a-zA-Z]/.test(char) ? char.toUpperCase() : char;
}

interface SubscriptionListItemProps {
  subscription: Subscription;
  onPress: () => void;
}

export function SubscriptionListItem({ subscription, onPress }: SubscriptionListItemProps) {
  const isOverdue = subscription.status === 'active' && isOverdueRenewal(subscription.nextRenewalDate);
  const isUpcoming = !isOverdue && subscription.status === 'active' && isWithinNextDays(subscription.nextRenewalDate, UPCOMING_RENEWAL_DAYS);

  const [logoError, setLogoError] = useState(false);
  const logoUrl = getServiceLogoUrl(subscription.normalizedName);
  const showLogo = !!logoUrl && !logoError;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.container}>
      <View style={[styles.avatar, isOverdue && styles.avatarOverdue, isUpcoming && styles.avatarUpcoming]}>
        {showLogo ? (
          <Image
            source={{ uri: logoUrl }}
            style={styles.logoImage}
            onError={() => setLogoError(true)}
          />
        ) : (
          <Text style={[styles.avatarChar, isOverdue && styles.avatarCharAlert]}>
            {getAvatarChar(subscription.serviceName)}
          </Text>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>{subscription.serviceName}</Text>
          <Text style={styles.amount}>
            {subscription.billingCycle === 'free'
              ? '無料'
              : `${formatAmount(subscription.amount, subscription.currency ?? 'JPY')} / ${BILLING_CYCLE_LABELS[subscription.billingCycle]}`}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          {subscription.status !== 'active' && <StatusBadge status={subscription.status} />}
          {(isOverdue || isUpcoming) && subscription.nextRenewalDate && (
            <View style={styles.renewalRow}>
              {isOverdue && (
                <Ionicons name="alert-circle" size={12} color={COLORS.destructive} />
              )}
              {isUpcoming && (
                <Ionicons name="time-outline" size={12} color={COLORS.status.reviewing.text} />
              )}
              <Text
                numberOfLines={1}
                style={[
                  styles.renewal,
                  isOverdue && styles.renewalOverdue,
                  isUpcoming && styles.renewalUpcoming,
                ]}
              >
                {isOverdue ? '更新日超過 ' : '更新が近い '}
                {formatShortDate(subscription.nextRenewalDate)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChar: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
  },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 7,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  amount: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '700',
  },
  avatarOverdue: {
    backgroundColor: COLORS.destructiveLight,
  },
  avatarUpcoming: {
    backgroundColor: COLORS.status.reviewing.bg,
  },
  avatarCharAlert: {
    color: COLORS.destructive,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  renewalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  renewal: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  renewalOverdue: {
    color: COLORS.destructive,
    fontWeight: '600',
  },
  renewalUpcoming: {
    color: COLORS.status.reviewing.text,
    fontWeight: '600',
  },
});
