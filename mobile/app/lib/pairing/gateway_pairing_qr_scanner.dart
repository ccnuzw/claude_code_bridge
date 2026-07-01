import 'package:flutter/services.dart';

abstract interface class GatewayPairingQrScanner {
  bool get usesNativeCamera;

  Future<String?> scanCamera();

  Future<String?> scanImage(String path);

  Future<String?> scanImageBytes(Uint8List bytes);

  Future<void> cancelActiveScan();
}

class MethodChannelGatewayPairingQrScanner implements GatewayPairingQrScanner {
  const MethodChannelGatewayPairingQrScanner({
    MethodChannel channel = const MethodChannel(
      'io.ccb.mobile/pairing_scanner',
    ),
  }) : _channel = channel;

  final MethodChannel _channel;

  @override
  bool get usesNativeCamera => true;

  @override
  Future<String?> scanCamera() {
    return _channel.invokeMethod<String>('scanPairingQr');
  }

  @override
  Future<String?> scanImage(String path) {
    return _channel.invokeMethod<String>('scanPairingQrImage', {'path': path});
  }

  @override
  Future<String?> scanImageBytes(Uint8List bytes) {
    return _channel.invokeMethod<String>('scanPairingQrImageBytes', {
      'bytes': bytes,
    });
  }

  @override
  Future<void> cancelActiveScan() {
    return _channel.invokeMethod<void>('cancelPairingQrScan');
  }
}
