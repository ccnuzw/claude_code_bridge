import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:ccb_mobile/pairing/gateway_pairing.dart';
import 'package:ccb_mobile/pairing/gateway_pairing_qr_scanner.dart';

const _qrPngBase64 = String.fromEnvironment('CCB_MOBILE_PAIRING_QR_PNG_BASE64');
const _expectedQrText = String.fromEnvironment('CCB_MOBILE_PAIRING_QR_TEXT');

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('native image scanner decodes generated pairing QR payload', (
    tester,
  ) async {
    expect(
      _qrPngBase64,
      isNotEmpty,
      reason: 'Pass CCB_MOBILE_PAIRING_QR_PNG_BASE64 for this smoke test.',
    );
    expect(
      _expectedQrText,
      isNotEmpty,
      reason: 'Pass CCB_MOBILE_PAIRING_QR_TEXT for this smoke test.',
    );

    final scanner = const MethodChannelGatewayPairingQrScanner();
    final decoded = await scanner.scanImageBytes(
      Uint8List.fromList(base64Decode(_qrPngBase64)),
    );

    expect(decoded, isNotNull);
    expect(jsonDecode(decoded!), jsonDecode(_expectedQrText));

    final payload = GatewayPairingPayload.fromQrText(decoded);
    expect(payload.pairingCode, isNotEmpty);
    expect(payload.gatewayUrl.scheme, isNotEmpty);
    expect(payload.claimEndpoint.path, '/v1/pairing/claim');
    expect(payload.toJson()['scopes'], isA<List<String>>());
  });
}
