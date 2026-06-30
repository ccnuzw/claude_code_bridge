import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'gateway_pairing.dart';

class GatewayPairingScannerScreen extends StatefulWidget {
  const GatewayPairingScannerScreen({super.key});

  @override
  State<GatewayPairingScannerScreen> createState() =>
      _GatewayPairingScannerScreenState();
}

class _GatewayPairingScannerScreenState
    extends State<GatewayPairingScannerScreen>
    with WidgetsBindingObserver {
  final MobileScannerController _controller = MobileScannerController(
    autoStart: false,
    formats: const [BarcodeFormat.qrCode],
  );
  bool _handled = false;
  String? _error;
  String? _cameraError;
  bool _startingCamera = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _scheduleScannerStart();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        if (_cameraError == null) {
          _scheduleScannerStart();
        }
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
      case AppLifecycleState.paused:
      case AppLifecycleState.detached:
        unawaited(_controller.stop());
    }
  }

  void _scheduleScannerStart() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _cameraError != null) {
        return;
      }
      unawaited(_startScanner());
    });
  }

  Future<void> _startScanner() async {
    if (_startingCamera || _controller.value.isRunning) {
      return;
    }
    setState(() {
      _startingCamera = true;
    });
    try {
      await _controller.start();
      if (!mounted) {
        return;
      }
      final scannerError = _controller.value.error;
      if (scannerError != null) {
        setState(() {
          _cameraError = gatewayPairingCameraErrorMessage(scannerError);
        });
        return;
      }
      if (_controller.value.availableCameras == 0) {
        setState(() {
          _cameraError = gatewayPairingCameraErrorMessage(
            const MobileScannerException(
              errorCode: MobileScannerErrorCode.unsupported,
            ),
          );
        });
      }
    } catch (error, stackTrace) {
      debugPrint('Gateway pairing scanner failed to start: $error');
      debugPrintStack(stackTrace: stackTrace);
      if (!mounted) {
        return;
      }
      setState(() {
        _cameraError = gatewayPairingCameraErrorMessage(error);
      });
    } finally {
      if (mounted) {
        setState(() {
          _startingCamera = false;
        });
      }
    }
  }

  void _retryScanner() {
    setState(() {
      _cameraError = null;
      _error = null;
    });
    _scheduleScannerStart();
  }

  void _handleDetect(BarcodeCapture capture) {
    if (_handled) {
      return;
    }
    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) {
      return;
    }
    final raw = barcodes.first.rawValue?.trim();
    if (raw == null || raw.isEmpty) {
      return;
    }
    try {
      final pairing = GatewayPairingPayload.fromQrText(raw);
      _handled = true;
      Navigator.of(context).pop(pairing);
    } on FormatException catch (error) {
      setState(() {
        _error = error.message;
      });
    } catch (error) {
      setState(() {
        _error = error.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final cameraError = _cameraError;
    return Scaffold(
      appBar: AppBar(title: const Text('Scan Pairing QR')),
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (cameraError == null)
            MobileScanner(
              controller: _controller,
              onDetect: _handleDetect,
              errorBuilder: _buildScannerError,
              placeholderBuilder:
                  (context) => const ColoredBox(color: Colors.black),
            )
          else
            GatewayPairingCameraErrorPanel(
              message: cameraError,
              onRetry: _retryScanner,
              onUseManualSetup: () => Navigator.of(context).pop(),
            ),
          if (cameraError == null) ...[
            Align(
              alignment: Alignment.topCenter,
              child: SafeArea(
                child: Container(
                  margin: const EdgeInsets.all(16),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: colorScheme.surface.withValues(alpha: 0.92),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _error ??
                        (_startingCamera
                            ? 'Starting camera...'
                            : 'Scan the CCB mobile pairing QR code'),
                    key: const ValueKey('gateway-pairing-scan-status'),
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              ),
            ),
            Center(
              child: IgnorePointer(
                child: Container(
                  width: 260,
                  height: 260,
                  decoration: BoxDecoration(
                    border: Border.all(color: colorScheme.primary, width: 3),
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildScannerError(
    BuildContext context,
    MobileScannerException error,
  ) {
    return GatewayPairingCameraErrorPanel(
      message: gatewayPairingCameraErrorMessage(error),
      onRetry: _retryScanner,
      onUseManualSetup: () => Navigator.of(context).pop(),
    );
  }
}

@visibleForTesting
String gatewayPairingCameraErrorMessage(Object error) {
  if (error is MobileScannerException) {
    return switch (error.errorCode) {
      MobileScannerErrorCode.permissionDenied =>
        'Camera permission denied. Enable camera access for CCB Mobile or use manual setup.',
      MobileScannerErrorCode.unsupported =>
        'This device does not expose a usable camera. Use manual setup instead.',
      MobileScannerErrorCode.controllerInitializing =>
        'Camera is still starting. Try again, or use manual setup.',
      _ => 'Camera could not be opened. Try again or use manual setup.',
    };
  }
  final text = error.toString().toLowerCase();
  if (text.contains('camera') ||
      text.contains('null object reference') ||
      text.contains('permission')) {
    return 'Camera could not be opened. Try again or use manual setup.';
  }
  return 'Scanner could not start. Try again or use manual setup.';
}

class GatewayPairingCameraErrorPanel extends StatelessWidget {
  const GatewayPairingCameraErrorPanel({
    required this.message,
    this.onRetry,
    required this.onUseManualSetup,
    super.key,
  });

  final String message;
  final VoidCallback? onRetry;
  final VoidCallback onUseManualSetup;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final mediaQuery = MediaQuery.of(context);
    return ColoredBox(
      color: Colors.black,
      child: Center(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: 360,
                maxHeight: mediaQuery.size.height - 48,
              ),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: colorScheme.surface,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: SingleChildScrollView(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.no_photography_outlined,
                          color: colorScheme.error,
                          size: 44,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Camera unavailable',
                          key: const ValueKey(
                            'gateway-pairing-scan-camera-error',
                          ),
                          style: Theme.of(context).textTheme.titleMedium,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          message,
                          key: const ValueKey(
                            'gateway-pairing-scan-camera-message',
                          ),
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: colorScheme.onSurfaceVariant),
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 12,
                          runSpacing: 8,
                          alignment: WrapAlignment.center,
                          children: [
                            if (onRetry != null)
                              OutlinedButton.icon(
                                key: const ValueKey(
                                  'gateway-pairing-scan-retry-button',
                                ),
                                onPressed: onRetry,
                                icon: const Icon(Icons.refresh),
                                label: const Text('Try camera again'),
                              ),
                            FilledButton.icon(
                              key: const ValueKey(
                                'gateway-pairing-scan-manual-button',
                              ),
                              onPressed: onUseManualSetup,
                              icon: const Icon(Icons.keyboard_outlined),
                              label: const Text('Use manual setup'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
