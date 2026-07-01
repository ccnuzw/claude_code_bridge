import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'package:ccb_mobile/ccb_mobile.dart';

void main() {
  test('scanner controller uses plugin auto start for camera lifecycle', () {
    final controller = gatewayPairingScannerController();
    addTearDown(controller.dispose);

    expect(controller.autoStart, isTrue);
    expect(controller.formats, [BarcodeFormat.qrCode]);
  });

  test('scanner lifecycle ignores permission and startup transitions', () {
    expect(
      gatewayPairingScannerLifecycleAction(
        state: AppLifecycleState.inactive,
        isStarting: true,
        hasCameraPermission: false,
      ),
      GatewayPairingScannerLifecycleAction.ignore,
    );
    expect(
      gatewayPairingScannerLifecycleAction(
        state: AppLifecycleState.inactive,
        isStarting: false,
        hasCameraPermission: false,
      ),
      GatewayPairingScannerLifecycleAction.ignore,
    );
    expect(
      gatewayPairingScannerLifecycleAction(
        state: AppLifecycleState.resumed,
        isStarting: false,
        hasCameraPermission: true,
      ),
      GatewayPairingScannerLifecycleAction.start,
    );
    expect(
      gatewayPairingScannerLifecycleAction(
        state: AppLifecycleState.inactive,
        isStarting: false,
        hasCameraPermission: true,
      ),
      GatewayPairingScannerLifecycleAction.stop,
    );
  });

  testWidgets('native scanner result closes with pairing payload', (
    tester,
  ) async {
    final scanner = _FakeQrScanner(cameraResult: _validPairingQrText());
    GatewayPairingPayload? seenPairing;

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            return ElevatedButton(
              onPressed: () async {
                seenPairing = await Navigator.of(context).push(
                  MaterialPageRoute<GatewayPairingPayload>(
                    builder:
                        (context) =>
                            GatewayPairingScannerScreen(qrScanner: scanner),
                  ),
                );
              },
              child: const Text('scan'),
            );
          },
        ),
      ),
    );

    await tester.tap(find.text('scan'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(scanner.cameraCalls, 1);
    expect(scanner.cancelCalls, greaterThanOrEqualTo(1));
    expect(seenPairing?.pairingCode, 'qr-code');
    expect(seenPairing?.gatewayUrl.toString(), 'http://127.0.0.1:8787');
  });

  testWidgets('native scanner cancels stale native session before opening', (
    tester,
  ) async {
    final scanner = _FakeQrScanner(cameraResult: _validPairingQrText());

    await tester.pumpWidget(
      MaterialApp(home: GatewayPairingScannerScreen(qrScanner: scanner)),
    );
    await tester.pump();
    await tester.pumpAndSettle();

    expect(scanner.cancelCalls, greaterThanOrEqualTo(1));
    expect(scanner.cameraCalls, 1);
  });

  testWidgets('native scanner still opens when cancel bridge is missing', (
    tester,
  ) async {
    final scanner = _FakeQrScanner(
      cameraResult: _validPairingQrText(),
      cancelError: MissingPluginException(),
    );
    GatewayPairingPayload? seenPairing;

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            return ElevatedButton(
              onPressed: () async {
                seenPairing = await Navigator.of(context).push(
                  MaterialPageRoute<GatewayPairingPayload>(
                    builder:
                        (context) =>
                            GatewayPairingScannerScreen(qrScanner: scanner),
                  ),
                );
              },
              child: const Text('scan'),
            );
          },
        ),
      ),
    );

    await tester.tap(find.text('scan'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(scanner.cancelCalls, greaterThanOrEqualTo(1));
    expect(scanner.cameraCalls, 1);
    expect(seenPairing?.pairingCode, 'qr-code');
  });

  testWidgets('image scan remains available when cancel bridge is missing', (
    tester,
  ) async {
    final scanner = _FakeQrScanner(cancelError: MissingPluginException());

    await tester.pumpWidget(
      MaterialApp(home: GatewayPairingScannerScreen(qrScanner: scanner)),
    );
    await tester.pump();
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('gateway-pairing-image-scan-button')),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('native scanner cancels pending native session on dispose', (
    tester,
  ) async {
    final scanner = _FakeQrScanner(cameraCompleter: Completer<String?>());

    await tester.pumpWidget(
      MaterialApp(home: GatewayPairingScannerScreen(qrScanner: scanner)),
    );
    await tester.pump();

    expect(scanner.cancelCalls, 1);
    expect(scanner.cameraCalls, 1);

    await tester.pumpWidget(const MaterialApp(home: SizedBox.shrink()));
    await tester.pump();

    expect(scanner.cancelCalls, 2);
  });

  testWidgets('native scanner cancel exposes image and manual paths', (
    tester,
  ) async {
    final scanner = _FakeQrScanner();

    await tester.pumpWidget(
      MaterialApp(home: GatewayPairingScannerScreen(qrScanner: scanner)),
    );
    await tester.pump();
    await tester.pumpAndSettle();

    expect(scanner.cameraCalls, 1);
    expect(
      find.text(
        'Scan canceled. Try camera, choose an image, or use manual setup.',
      ),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('gateway-pairing-image-scan-button')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('gateway-pairing-scan-manual-button')),
      findsOneWidget,
    );
  });

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

  test('native scanner error message is actionable', () {
    final message = gatewayPairingNativeScannerErrorMessage(
      PlatformException(
        code: 'scanner_unavailable',
        message: 'w4 null object reference',
      ),
    );

    expect(
      message,
      'Android scanner could not be opened. Try image scan or manual setup.',
    );
    expect(message, isNot(contains('w4')));
  });

  test('method channel scanner sends image bytes to native bridge', () async {
    const channel = MethodChannel('test_pairing_scanner');
    final calls = <MethodCall>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          calls.add(call);
          return 'qr';
        });
    addTearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null);
    });

    final scanner = MethodChannelGatewayPairingQrScanner(channel: channel);

    final result = await scanner.scanImageBytes(Uint8List.fromList([1, 2, 3]));

    expect(result, 'qr');
    expect(calls.single.method, 'scanPairingQrImageBytes');
    expect(calls.single.arguments, {
      'bytes': Uint8List.fromList([1, 2, 3]),
    });
  });
}

class _FakeQrScanner implements GatewayPairingQrScanner {
  _FakeQrScanner({this.cameraResult, this.cameraCompleter, this.cancelError});

  final String? cameraResult;
  final Completer<String?>? cameraCompleter;
  final Object? cancelError;
  var cameraCalls = 0;
  var imageCalls = 0;
  var cancelCalls = 0;

  @override
  bool get usesNativeCamera => true;

  @override
  Future<String?> scanCamera() async {
    cameraCalls += 1;
    if (cameraCompleter != null) {
      return cameraCompleter!.future;
    }
    return cameraResult;
  }

  @override
  Future<String?> scanImage(String path) async {
    imageCalls += 1;
    return null;
  }

  @override
  Future<String?> scanImageBytes(Uint8List bytes) async {
    imageCalls += 1;
    return null;
  }

  @override
  Future<void> cancelActiveScan() async {
    cancelCalls += 1;
    final error = cancelError;
    if (error != null) {
      throw error;
    }
    if (cameraCalls > 0 &&
        cameraCompleter != null &&
        !cameraCompleter!.isCompleted) {
      cameraCompleter!.complete(null);
    }
  }
}

String _validPairingQrText() {
  return jsonEncode({
    'pairing_code': 'qr-code',
    'claim_endpoint': 'http://127.0.0.1:8787/v1/pairing/claim',
    'route_provider': 'lan',
    'gateway_url': 'http://127.0.0.1:8787',
    'scopes': ['view', 'message_submit'],
  });
}
