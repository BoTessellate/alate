/**
 * ScreenErrorBoundary
 *
 * Wraps individual screens so an unhandled render error shows a recoverable
 * fallback instead of a white screen. Reports to both Sentry and Crashlytics.
 *
 * Usage:
 *   <ScreenErrorBoundary name="HomeScreen">
 *     <HomeScreen />
 *   </ScreenErrorBoundary>
 *
 * The `name` prop tags the crash report so you can filter by screen in Sentry.
 */

import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { captureError } from '../utils/sentry';
import { colors, spacing, typography, borderRadius, fontFamily } from '../constants/theme';

interface Props {
  children: ReactNode;
  /** Screen name — used as a tag in Sentry/Crashlytics reports. */
  name: string;
}

interface State {
  hasError: boolean;
}

export default class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureError(error, {
      feature: 'screen-error-boundary',
      screen: this.props.name,
      componentStack: info.componentStack ?? 'unknown',
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>!</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            This screen ran into a problem. The error has been reported automatically.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={this.handleRetry}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  icon: {
    fontFamily: fontFamily.primaryBold,
    fontSize: 48,
    fontWeight: '400',
    color: colors.error,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.headingM,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.cta,
    borderRadius: borderRadius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  buttonText: {
    ...typography.button,
    color: colors.white,
    fontWeight: '400',
  },
});
