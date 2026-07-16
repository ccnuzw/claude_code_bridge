import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../features/project_home/project_home_screen.dart';
import '../l10n/ccb_mobile_localizations.dart';
import '../pairing/gateway_pairing.dart';
import '../repository/fake_mobile_ccb_repository.dart';
import 'app_theme.dart';
import 'background_connection.dart';

class CcbMobileApp extends StatefulWidget {
  const CcbMobileApp({
    this.enableProductOnboarding = true,
    this.themePreferenceStore,
    this.backgroundConnectionPreferenceStore,
    this.backgroundConnectionPlatform,
    this.profileStore,
    super.key,
  });

  final bool enableProductOnboarding;
  final CcbThemePreferenceStore? themePreferenceStore;
  final CcbBackgroundConnectionPreferenceStore?
  backgroundConnectionPreferenceStore;
  final BackgroundConnectionPlatform? backgroundConnectionPlatform;
  final GatewayHostProfileStore? profileStore;

  @override
  State<CcbMobileApp> createState() => _CcbMobileAppState();
}

class _CcbMobileAppState extends State<CcbMobileApp> {
  late final CcbThemePreferenceStore _themePreferenceStore =
      widget.themePreferenceStore ?? FlutterCcbThemePreferenceStore();
  late final CcbBackgroundConnectionPreferenceStore
  _backgroundConnectionPreferenceStore =
      widget.backgroundConnectionPreferenceStore ??
      FlutterCcbBackgroundConnectionPreferenceStore();
  CcbThemePreference _themePreference = CcbThemePreference.system;
  bool _backgroundConnectionEnabled = false;
  bool _backgroundConnectionPreferenceLoaded = false;

  @override
  void initState() {
    super.initState();
    _loadThemePreference();
    _loadBackgroundConnectionPreference();
  }

  Future<void> _loadThemePreference() async {
    final preference = await _themePreferenceStore.read();
    if (!mounted) {
      return;
    }
    setState(() {
      _themePreference = preference;
    });
  }

  void _setThemePreference(CcbThemePreference preference) {
    setState(() {
      _themePreference = preference;
    });
    unawaited(_themePreferenceStore.write(preference));
  }

  Future<void> _loadBackgroundConnectionPreference() async {
    final enabled = await _backgroundConnectionPreferenceStore.read();
    if (!mounted) {
      return;
    }
    setState(() {
      _backgroundConnectionEnabled = enabled;
      _backgroundConnectionPreferenceLoaded = true;
    });
  }

  void _setBackgroundConnectionEnabled(bool enabled) {
    setState(() {
      _backgroundConnectionEnabled = enabled;
      _backgroundConnectionPreferenceLoaded = true;
    });
    unawaited(_backgroundConnectionPreferenceStore.write(enabled));
  }

  @override
  Widget build(BuildContext context) {
    final repository = FakeMobileCcbRepository.demo();
    return MaterialApp(
      onGenerateTitle: (context) => CcbMobileLocalizations.of(context).appTitle,
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      supportedLocales: CcbMobileLocalizations.supportedLocales,
      theme: ccbLightTheme(),
      darkTheme: ccbDarkTheme(),
      themeMode: _themePreference.themeMode,
      home: ProjectHomeScreen(
        repository: repository,
        profileStore: widget.profileStore,
        showOnboardingWhenUnpaired: widget.enableProductOnboarding,
        autoActivateStoredProfile: widget.enableProductOnboarding,
        themePreference: _themePreference,
        onThemePreferenceChanged: _setThemePreference,
        backgroundConnectionEnabled: _backgroundConnectionEnabled,
        backgroundConnectionPreferenceLoaded:
            _backgroundConnectionPreferenceLoaded,
        onBackgroundConnectionEnabledChanged: _setBackgroundConnectionEnabled,
        backgroundConnectionPlatform: widget.backgroundConnectionPlatform,
      ),
    );
  }
}
