import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'package:ccb_mobile/ccb_mobile.dart';

void main() {
  testWidgets('camera error panel offers manual setup fallback', (
    tester,
  ) async {
    var manualSelected = false;

    await tester.pumpWidget(
      MaterialApp(
        home: GatewayPairingCameraErrorPanel(
          message:
              'Camera permission denied. Enable camera access for CCB Mobile or use manual setup.',
          onUseManualSetup: () {
            manualSelected = true;
          },
        ),
      ),
    );

    expect(
      find.byKey(const ValueKey('gateway-pairing-scan-camera-error')),
      findsOneWidget,
    );
    expect(find.text('Camera unavailable'), findsOneWidget);
    expect(
      find.text(
        'Camera permission denied. Enable camera access for CCB Mobile or use manual setup.',
      ),
      findsOneWidget,
    );

    await tester.tap(
      find.byKey(const ValueKey('gateway-pairing-scan-manual-button')),
    );

    expect(manualSelected, isTrue);
  });

  testWidgets('camera error panel can retry and constrains long details', (
    tester,
  ) async {
    var retried = false;
    var manualSelected = false;

    await tester.pumpWidget(
      MaterialApp(
        home: GatewayPairingCameraErrorPanel(
          message: 'Camera could not be opened. Try again or use manual setup.',
          onRetry: () {
            retried = true;
          },
          onUseManualSetup: () {
            manualSelected = true;
          },
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(
      find.byKey(const ValueKey('gateway-pairing-scan-retry-button')),
      findsOneWidget,
    );

    await tester.tap(
      find.byKey(const ValueKey('gateway-pairing-scan-retry-button')),
    );
    expect(retried, isTrue);

    await tester.tap(
      find.byKey(const ValueKey('gateway-pairing-scan-manual-button')),
    );
    expect(manualSelected, isTrue);
  });

  test('camera error message hides native implementation details', () {
    final message = gatewayPairingCameraErrorMessage(
      Exception(
        "Attempt to invoke virtual method 'w4.c w4.b.a(s4.b)' on a null object reference",
      ),
    );

    expect(
      message,
      'Camera could not be opened. Try again or use manual setup.',
    );
    expect(message, isNot(contains('null object reference')));
    expect(message, isNot(contains('w4.')));
  });

  test('camera permission error has actionable message', () {
    final message = gatewayPairingCameraErrorMessage(
      const MobileScannerException(
        errorCode: MobileScannerErrorCode.permissionDenied,
      ),
    );

    expect(message, contains('Camera permission denied'));
    expect(message, contains('manual setup'));
  });
}
