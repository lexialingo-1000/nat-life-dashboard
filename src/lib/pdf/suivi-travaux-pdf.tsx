import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer';

// dashboard-22 — PDF suivi de travaux (marché → sous-lot → tâches + photos)

Font.register({
  family: 'Helvetica',
  fonts: [],
});

const STATUS_LABELS: Record<string, string> = {
  a_faire: 'À faire',
  en_attente: 'En attente',
  en_cours: 'En cours',
  termine: 'Terminé',
  valide: 'Validé',
};

const STATUS_COLOR: Record<string, string> = {
  a_faire: '#71717a',
  en_attente: '#a1a1aa',
  en_cours: '#f59e0b',
  termine: '#10b981',
  valide: '#3b82f6',
};

const MARCHE_STATUS_LABELS: Record<string, string> = {
  signe: 'Signé',
  en_cours: 'En cours',
  livre: 'Livré',
  conteste: 'Contesté',
  annule: 'Annulé',
};

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#18181b',
    padding: 36,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e4e7',
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#18181b',
    marginBottom: 2,
  },
  headerMeta: {
    fontSize: 8,
    color: '#71717a',
  },
  marche: {
    marginBottom: 14,
  },
  marcheHeader: {
    backgroundColor: '#f4f4f5',
    padding: '6 8',
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marcheTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#18181b',
  },
  marcheMeta: {
    fontSize: 7.5,
    color: '#52525b',
  },
  sousLot: {
    marginBottom: 6,
    marginLeft: 8,
  },
  sousLotHeader: {
    borderLeftWidth: 2,
    borderLeftColor: '#a1a1aa',
    paddingLeft: 6,
    marginBottom: 3,
  },
  sousLotName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: '#3f3f46',
    textTransform: 'uppercase',
  },
  tache: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f5',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 1.5,
    flexShrink: 0,
  },
  tacheBody: {
    flex: 1,
  },
  tacheTitle: {
    fontSize: 9,
    color: '#18181b',
  },
  tacheMeta: {
    fontSize: 7.5,
    color: '#71717a',
    marginTop: 1,
  },
  statusPill: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginTop: 1,
  },
  photosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
    marginLeft: 12,
  },
  photo: {
    width: 72,
    height: 72,
    objectFit: 'cover',
    borderRadius: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 7,
    color: '#a1a1aa',
  },
  emptyState: {
    padding: 20,
    textAlign: 'center',
    color: '#71717a',
    fontSize: 9,
  },
});

export interface PdfTache {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  locationDescription: string | null;
  roomName: string | null;
  levelName: string | null;
  photos: string[]; // presigned URLs
}

export interface PdfSousLot {
  id: string;
  name: string;
  status: string;
  marcheTypeLabel: string | null;
  taches: PdfTache[];
}

export interface PdfMarche {
  id: string;
  name: string;
  supplierName: string;
  status: string;
  amountHt: string | null;
  sousLots: PdfSousLot[];
}

interface Props {
  marches: PdfMarche[];
  title: string;
  subtitle?: string;
  generatedAt: string;
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function SuiviTravauxPDF({ marches, title, subtitle, generatedAt }: Props) {
  const totalTaches = marches.reduce(
    (acc, m) => acc + m.sousLots.reduce((a, s) => a + s.taches.length, 0),
    0,
  );

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* En-tête */}
        <View style={s.header}>
          <Text style={s.headerTitle}>{title}</Text>
          {subtitle && <Text style={{ ...s.headerMeta, marginBottom: 2 }}>{subtitle}</Text>}
          <Text style={s.headerMeta}>
            Généré le {generatedAt} — {totalTaches} tâche{totalTaches > 1 ? 's' : ''}
          </Text>
        </View>

        {marches.length === 0 ? (
          <Text style={s.emptyState}>Aucune tâche de suivi.</Text>
        ) : (
          marches.map((marche) => (
            <View key={marche.id} style={s.marche} wrap={false}>
              {/* En-tête marché */}
              <View style={s.marcheHeader}>
                <View>
                  <Text style={s.marcheTitle}>{marche.name}</Text>
                  <Text style={s.marcheMeta}>{marche.supplierName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.marcheMeta}>
                    {MARCHE_STATUS_LABELS[marche.status] ?? marche.status}
                  </Text>
                  {marche.amountHt && (
                    <Text style={s.marcheMeta}>
                      {Number(marche.amountHt).toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                      })}{' '}
                      HT
                    </Text>
                  )}
                </View>
              </View>

              {/* Sous-lots */}
              {marche.sousLots.map((sousLot) => (
                <View key={sousLot.id} style={s.sousLot}>
                  <View style={s.sousLotHeader}>
                    <Text style={s.sousLotName}>
                      {sousLot.name}
                      {sousLot.marcheTypeLabel ? ` — ${sousLot.marcheTypeLabel}` : ''}
                    </Text>
                  </View>

                  {sousLot.taches.map((tache) => {
                    const emplacement = [tache.levelName, tache.roomName, tache.locationDescription]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <View key={tache.id} wrap={false}>
                        <View style={s.tache}>
                          <View
                            style={{
                              ...s.statusDot,
                              backgroundColor: STATUS_COLOR[tache.status] ?? '#71717a',
                            }}
                          />
                          <View style={s.tacheBody}>
                            <Text style={s.tacheTitle}>{tache.title}</Text>
                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 1 }}>
                              <Text
                                style={{
                                  ...s.statusPill,
                                  backgroundColor: `${STATUS_COLOR[tache.status] ?? '#71717a'}22`,
                                  color: STATUS_COLOR[tache.status] ?? '#71717a',
                                }}
                              >
                                {STATUS_LABELS[tache.status] ?? tache.status}
                              </Text>
                              {tache.dueDate && (
                                <Text style={s.tacheMeta}>
                                  Échéance : {formatDate(tache.dueDate)}
                                </Text>
                              )}
                              {emplacement && <Text style={s.tacheMeta}>{emplacement}</Text>}
                            </View>
                          </View>
                        </View>
                        {tache.photos.length > 0 && (
                          <View style={s.photosRow}>
                            {tache.photos.slice(0, 4).map((url, i) => (
                              <Image key={i} src={url} style={s.photo} />
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          ))
        )}

        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) => `FKA Holding — Page ${pageNumber}/${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
