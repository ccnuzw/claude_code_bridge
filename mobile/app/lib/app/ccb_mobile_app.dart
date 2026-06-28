import 'package:flutter/material.dart';

import '../features/project_home/project_home_screen.dart';
import '../repository/fake_mobile_ccb_repository.dart';

class CcbMobileApp extends StatelessWidget {
  const CcbMobileApp({this.enableProductOnboarding = true, super.key});

  final bool enableProductOnboarding;

  @override
  Widget build(BuildContext context) {
    final repository = FakeMobileCcbRepository.demo();
    return MaterialApp(
      title: 'CCB Mobile',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff116149)),
        useMaterial3: true,
      ),
      home: ProjectHomeScreen(
        repository: repository,
        showOnboardingWhenUnpaired: enableProductOnboarding,
        autoActivateStoredProfile: enableProductOnboarding,
      ),
    );
  }
}
