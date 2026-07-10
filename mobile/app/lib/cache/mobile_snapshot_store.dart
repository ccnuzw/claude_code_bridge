import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// Bounded, read-only startup snapshots. Pairing credentials intentionally
/// never enter this file: callers provide a stable host namespace, not a token.
class MobileSnapshotStore {
  MobileSnapshotStore({
    Future<File> Function()? fileFactory,
    this.maxEntries = 48,
    this.maxBytes = 2 * 1024 * 1024,
    DateTime Function()? clock,
  }) : _fileFactory = fileFactory ?? _defaultFile,
       _clock = clock ?? DateTime.now;

  static const schemaVersion = 1;

  final Future<File> Function() _fileFactory;
  final DateTime Function() _clock;
  final int maxEntries;
  final int maxBytes;

  static Future<File> _defaultFile() async {
    final directory = await getApplicationDocumentsDirectory();
    return File(p.join(directory.path, 'mobile_readonly_snapshots.json'));
  }

  Future<Map<String, Object?>?> read(String key) async {
    final data = await _readData();
    final entries = _entries(data);
    final raw = entries[key];
    if (raw is! Map) {
      return null;
    }
    final payload = raw['payload'];
    if (payload is! Map) {
      return null;
    }
    return {
      for (final item in payload.entries) item.key.toString(): item.value,
    };
  }

  Future<Map<String, Object?>?> readLatestWithPrefix(String prefix) async {
    final entries = _entries(await _readData());
    MapEntry<String, Object?>? latest;
    for (final entry in entries.entries) {
      if (!entry.key.startsWith(prefix) || entry.value is! Map) {
        continue;
      }
      if (latest == null ||
          _updatedAt(entry.value).isAfter(_updatedAt(latest.value))) {
        latest = entry;
      }
    }
    final raw = latest?.value;
    final payload = raw is Map ? raw['payload'] : null;
    if (payload is! Map) {
      return null;
    }
    return {
      for (final item in payload.entries) item.key.toString(): item.value,
    };
  }

  Future<void> write(String key, Map<String, Object?> payload) async {
    final normalized = key.trim();
    if (normalized.isEmpty) {
      return;
    }
    final data = await _readData();
    final entries = _entries(data);
    entries[normalized] = {
      'updated_at': _clock().toUtc().toIso8601String(),
      'payload': payload,
    };
    final bounded = _boundedEntries(entries);
    data
      ..['schema_version'] = schemaVersion
      ..['entries'] = bounded;
    await _writeData(data);
  }

  Future<Map<String, Object?>> _readData() async {
    final file = await _fileFactory();
    try {
      if (!await file.exists()) {
        return _emptyData();
      }
      final decoded = jsonDecode(await file.readAsString());
      if (decoded is Map && decoded['schema_version'] == schemaVersion) {
        return {
          for (final item in decoded.entries) item.key.toString(): item.value,
        };
      }
    } catch (_) {
      // A partial/corrupt cache must never block a real gateway load.
    }
    return _emptyData();
  }

  Future<void> _writeData(Map<String, Object?> data) async {
    final file = await _fileFactory();
    final temp = File('${file.path}.tmp');
    try {
      await file.parent.create(recursive: true);
      await temp.writeAsString(jsonEncode(data));
      await temp.rename(file.path);
    } catch (_) {
      // Snapshots are opportunistic. Do not surface local storage failures as
      // connection failures, and leave a later write free to recover.
      try {
        if (await temp.exists()) {
          await temp.delete();
        }
      } catch (_) {}
    }
  }

  Map<String, Object?> _boundedEntries(Map<String, Object?> entries) {
    final ordered =
        entries.entries.where((entry) => entry.value is Map).toList()
          ..sort((a, b) => _updatedAt(a.value).compareTo(_updatedAt(b.value)));
    final result = <String, Object?>{};
    var usedBytes = 0;
    for (final entry in ordered.reversed) {
      final encoded = jsonEncode({entry.key: entry.value});
      final byteCount = utf8.encode(encoded).length;
      if (result.length >= maxEntries || usedBytes + byteCount > maxBytes) {
        continue;
      }
      result[entry.key] = entry.value;
      usedBytes += byteCount;
    }
    return result;
  }

  static Map<String, Object?> _emptyData() => {
    'schema_version': schemaVersion,
    'entries': <String, Object?>{},
  };

  static Map<String, Object?> _entries(Map<String, Object?> data) {
    final raw = data['entries'];
    if (raw is Map) {
      return {for (final item in raw.entries) item.key.toString(): item.value};
    }
    return <String, Object?>{};
  }

  static DateTime _updatedAt(Object? value) {
    if (value is Map) {
      return DateTime.tryParse((value['updated_at'] ?? '').toString()) ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
    }
    return DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
  }
}

String mobileSnapshotNamespace({
  required String hostId,
  required String deviceId,
}) => '${Uri.encodeComponent(hostId)}:${Uri.encodeComponent(deviceId)}';

String mobileProjectsSnapshotKey(String namespace) => 'projects:$namespace';

String mobileProjectViewSnapshotKey({
  required String namespace,
  required String projectId,
  required int? namespaceEpoch,
}) =>
    'view:$namespace:${Uri.encodeComponent(projectId)}:${namespaceEpoch ?? 'none'}';

String mobileProjectViewSnapshotPrefix({
  required String namespace,
  required String projectId,
}) => 'view:$namespace:${Uri.encodeComponent(projectId)}:';

String mobileConversationSnapshotKey({
  required String namespace,
  required String projectId,
  required String agent,
  required int namespaceEpoch,
}) =>
    'conversation:$namespace:${Uri.encodeComponent(projectId)}:'
    '${Uri.encodeComponent(agent)}:$namespaceEpoch';
