import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

import { getSupabase } from '../services/supabase';

// New themes to add to app_settings custom_themes (beyond any starter set)
const NEW_THEMES = [
  'freedom', 'holy spirit', 'cross', 'faithfulness', 'testimony',
  'healing', 'blessing', 'revival', 'celebration', 'devotion',
];

// song_id → themes mapping (IDs sourced directly from DB, 2026-05-19)
const THEME_MAP: Record<string, string[]> = {
  // A
  '020116ab-e8c9-430a-ab6c-919ca5b6ef49': ['worship', 'holiness', 'glory'],                          // Agnus Dei
  '39922bab-fe09-4e96-9e99-9186e6a69445': ['praise', 'glory', 'worship'],                            // All Glory
  '325f2d9f-569a-4c69-92de-3e7a80dd4e1b': ['praise', 'glory', 'worship', 'victory'],                 // All Hail King Jesus
  'f560b458-d6d4-4499-81ba-a8c75a93a06e': ['worship', 'glory', 'praise'],                            // Alpha And Omega
  '9d130c5f-dffb-4f0f-bea1-fb4819930fad': ['grace', 'salvation', 'freedom', 'redemption'],           // Amazing Grace (My Chains Are Gone)
  'b1596f95-f56b-4e24-b590-9c734cb0e9b3': ['hope', 'faith', 'peace'],                                // Anchor
  'b1add14d-ff77-45fb-830f-2ab96d524ef5': ['praise', 'worship', 'presence'],                         // Alleluia (Jesus Culture)
  '9dcd3a01-ae54-44ab-9fd9-9dbcf2d64676': ['praise', 'worship'],                                     // Alleluia (Live) - Elevation
  '4c7c8ac1-2ef6-48cf-8ef8-28e50c182d7e': ['praise', 'joy', 'celebration'],                          // Arriba! (planetboom)

  // B
  'd07c6da1-1551-4e8b-ab5d-ef1e5edf0cb0': ['resurrection', 'hope', 'victory'],                       // Because He Lives (Moment)
  '99a30ffd-2719-460d-bf36-f82294404d54': ['salvation', 'grace', 'redemption'],                      // Because of Christ
  '50d49b38-88bc-4a50-aae3-998df8b381af': ['gratitude', 'testimony', 'faithfulness'],                // Been So Good
  'f1651995-68c8-4f4d-b8d8-807561460e89': ['praise', 'blessing', 'worship'],                         // Bless God
  '6d9511da-d25e-488a-99e4-4dbbbdd44d5d': ['praise', 'blessing', 'worship'],                         // Blessed Be The Lord (Live)
  '45c5300f-b848-416d-8f3f-5203f393ccaf': ['freedom', 'victory', 'presence'],                        // Break Every Chain

  // C
  '98be7380-8a73-460b-9309-f10896eea80a': ['surrender', 'worship', 'presence'],                      // Center (Live)
  '8b39c4ef-c6bf-4a5e-944c-1cf5247c05bd': ['holy spirit', 'presence'],                               // Come Holy Spirit
  '87da6d1e-70cb-4d7a-9196-1175a84fcdc1': ['worship', 'glory'],                                      // Crown Of Heaven

  // D
  '244936c2-fd81-4452-8ae7-e8d6179d435c': ['faith', 'testimony', 'faithfulness'],                    // Do It Again

  // E
  '48e8d655-4e84-4c14-891f-afe254254d44': ['worship', 'glory', 'praise'],                            // Elohim
  'a08569d1-6b8b-4244-810e-6173a4201277': ['praise', 'worship'],                                     // Endless Praise
  '88aeafee-6b0a-4166-a77c-15a9a6d493e4': ['victory', 'faith', 'testimony'],                         // Every Victory

  // F
  'a538a2be-f7a2-4a2f-a299-69cc9e0a6fa4': ['holy spirit', 'presence', 'surrender'],                  // Fall Afresh
  '7fe7287d-e76e-427a-a2ca-26ce1edfcfba': ['holy spirit', 'presence', 'revival'],                    // Fall Like Rain
  '4cd22c5f-0873-4bab-b361-d5ba48c9f224': ['faithfulness', 'testimony', 'faith'],                    // Faithful Then Faithful Now
  '191ac167-f083-4d76-a34a-db12670efcea': ['holy spirit', 'presence'],                               // Fill This House
  '66290a21-8ca9-4317-aca9-292dc125ce71': ['faith', 'hope', 'faithfulness'],                         // Firm Foundation (He Won't)
  '56ac88ca-cf3d-468c-af8b-77001c4a3332': ['worship', 'glory', 'praise'],                            // Forever
  '69970b09-3347-4a14-8fb2-47e1dc014640': ['worship', 'praise', 'glory'],                            // Forever YHWH
  '09ec9e55-c0ac-4878-9441-539d15d095f3': ['freedom', 'grace', 'salvation'],                         // Free
  '35ec20b9-d244-45e1-bbba-d20ffc2fb304': ['salvation', 'freedom', 'grace'],                         // Free and Saved
  'd64717c1-94c7-48e5-9c7e-16b1936b1226': ['freedom', 'victory', 'hope'],                            // Freedom Is Coming
  'c3a20a07-0700-4208-97b9-2e1c16fa6c40': ['holy spirit', 'renewal', 'revival'],                     // Fresh Wind

  // G
  '0d91b465-9502-4a3f-b9d6-53c276bbe037': ['praise', 'joy', 'freedom'],                              // Garment of Praise
  '28ad56db-2cec-479e-9e11-036010168318': ['faith', 'victory', 'hope'],                              // Get Up
  '97cea5bb-4685-47f8-9c36-5b3aee3c36f6': ['surrender', 'devotion', 'love'],                         // Give Me Jesus
  '8112ae90-39e0-438a-9f39-c4f12ad32c26': ['resurrection', 'salvation', 'victory'],                  // Glorious Day
  '68634d4d-841a-455b-a018-97d46c92fc13': ['gratitude', 'worship'],                                  // God I'm Just Grateful
  'a1f206d2-c1b9-411f-9b87-755b1801a8c2': ['joy', 'gratitude', 'faith'],                             // Good Times
  'ef8ad327-d996-4caf-a74f-24d683ce13d5': ['grace', 'freedom', 'renewal'],                           // Goodbye Yesterday
  'dcdc8bb3-169b-4bdc-8cb9-bae22f2298e6': ['gratitude', 'faithfulness', 'love'],                     // Goodness Of God
  '5f60a81d-48a9-4399-8435-76aa8e89314f': ['praise', 'glory', 'worship'],                            // Great and Mighty
  '4d80ad88-7533-4e8c-930a-14ad0997451d': ['worship', 'praise', 'glory'],                            // Great Are You Lord
  '9b814be5-900d-43b7-bc28-61069ac95a56': ['faithfulness', 'gratitude', 'hope'],                     // Great Is Thy Faithfulness
  '6489ffbe-187d-4370-8463-23f6a581695e': ['praise', 'worship'],                                     // Greatest in the World
  'f1f388e7-3bee-4fdd-bcb1-d7e5300ebc25': ['gratitude', 'worship', 'praise'],                        // Gratitude

  // H
  '4bdaae3c-d942-4b1a-af6b-a2ef969f5161': ['surrender', 'love', 'devotion'],                         // Have My Heart
  'fd87f0ba-cbc5-4a25-a1fc-3409d68154da': ['holiness', 'worship'],                                   // He Is Holy
  '979c9f5e-c28f-4588-bae4-5a21b09de80d': ['holiness', 'worship', 'glory'],                          // Holy Forever
  '5f77b003-f7c2-4b25-8cc8-9861a00e298a': ['holiness', 'presence', 'worship'],                       // Holy Ground (Passion)
  '510c4b22-e60d-4791-961a-1360da188f72': ['holy spirit', 'presence', 'worship'],                    // Holy Spirit
  'f0922d82-0ea4-4ed8-9b41-22830f69a312': ['hope', 'glory'],                                         // Homecoming
  '0010a143-ba44-4a92-957e-8ae37b06f5b4': ['praise', 'salvation', 'worship'],                        // Hosanna (Brooke Fraser)
  'd7133d6f-7aed-49fa-b044-92e58fec0ed3': ['praise', 'worship', 'salvation'],                        // Hosanna (Be Lifted Higher)
  'ec0a7668-9f4a-480b-a75d-2495d42fd060': ['worship', 'glory', 'trinity'],                           // How Great Is Our God
  '2896de08-ec52-4b6c-bbe3-08037ec79010': ['worship', 'glory', 'praise'],                            // How Great Thou Art

  // I
  '86ed18da-cc72-4b64-b165-d38bd2263787': ['worship', 'praise'],                                     // I Exalt Thee
  'bca30974-ad17-45c2-bb49-7de46fd6834b': ['salvation', 'hope', 'healing'],                          // I Know A Name
  '90de2c7c-fd2f-46cf-b5d3-b8e15fc72d9a': ['faith', 'love'],                                         // I Know That I Know (Live)
  'e86a5ce7-6516-4ad9-b769-268a6401882c': ['love', 'worship', 'devotion'],                           // I Love You Lord
  '4acbe456-c405-40ef-bb51-bcdb4dba2878': ['healing', 'salvation', 'faith'],                         // I Speak Jesus
  'd9502a70-425a-407e-9b63-5549514f2065': ['surrender', 'devotion', 'worship'],                      // I Surrender
  '772b133e-f2a8-4d4e-9772-f1fd90dcdeb1': ['gratitude', 'testimony', 'praise'],                      // I Thank God
  'be00def3-536d-47cf-9516-4524e7cfb6a1': ['worship', 'praise'],                                     // I Will Exalt You
  '434692c5-c857-4b52-92b2-c7e14ec706c6': ['praise', 'worship'],                                     // I Will Extol The Lord
  '5b43c36a-afc0-4752-8d63-a3561cb08544': ['testimony', 'faith', 'gratitude'],                       // I've Witnessed It
  '670688df-e77c-403b-8846-1cdd7232fd6b': ['salvation', 'faith', 'cross', 'hope'],                   // In Christ Alone
  '36adc778-f22c-4e7c-9b13-7863312a54f7': ['surrender', 'faith'],                                    // In Surrender
  '3388a9d9-c5e5-4bb4-813c-8569844f8586': ['worship', 'glory', 'resurrection'],                      // Is He Worthy
  'ecc195ea-7abb-4624-877b-9863d29ca3b8': ['salvation', 'cross', 'victory', 'redemption'],           // It Is Finished
  'a31c2975-1baa-4718-abfa-d60679e60bf6': ['peace', 'faith', 'hope'],                                // It Is Well With My Soul

  // J
  'fa10e317-26f2-465a-bee7-6d83046adedf': ['worship', 'surrender', 'devotion'],                      // Jesus At The Center
  '4cd5f495-59c9-482c-b437-5071a181af47': ['praise', 'salvation'],                                   // Jesus Be The Name
  'f5105371-0f4a-4605-81f6-42cc6df94f88': ['salvation', 'grace', 'victory'],                         // Jesus Made A Way
  'e8fec039-ad91-4748-858a-12bc6124c00b': ['joy', 'praise', 'worship'],                              // Joy (feat. Israel Houghton)
  '8557e223-0aa2-4d73-aba6-ecce9e69a4aa': ['worship', 'presence', 'devotion'],                       // Just Want You

  // K
  '4411d8ea-3d38-4ebc-ab4d-449fa7b3433f': ['glory', 'salvation', 'resurrection'],                    // King Of Kings

  // L
  '56b33b72-ac42-44f1-ab0b-0b70e2ff6187': ['surrender', 'cross', 'devotion'],                        // Lead Me To The Cross
  '7aba09d0-a910-4b99-99f0-bb52e46290f2': ['love', 'grace', 'salvation'],                            // Left The 99
  '5b35b110-9d9b-4798-adf3-53bd9a274f6f': ['holy spirit', 'revival', 'presence'],                    // Like a Fire
  'a12e5ee0-ceb3-419a-8abf-6a931c042d80': ['resurrection', 'hope', 'salvation'],                     // Living Hope
  '22b6bab4-ebbd-4a93-b881-602911e00e5b': ['freedom', 'salvation', 'victory'],                       // Living In Freedom
  'e399fdb4-7021-47b5-b559-1fbda380abec': ['holy spirit', 'presence', 'renewal'],                    // Living Water

  // M
  '83c2ccf6-fa71-4ce6-a432-8afac3d66492': ['renewal', 'grace'],                                      // Make Me New
  '67183acf-a6ed-4618-a2fb-bc36930580fa': ['surrender', 'holy spirit', 'presence'],                  // Make Room
  'a5601b3b-128c-46b1-9a29-4d6bc28f0a56': ['worship', 'praise'],                                     // Marvelous
  '2ca92c4c-b13e-47f6-9764-61e3226d5f75': ['praise', 'joy', 'celebration'],                          // Might Get Loud
  '331c6de4-6f5a-4a21-923d-e400a4baed72': ['praise', 'victory'],                                     // Mighty Name Of Jesus (Live)
  '6bb2da8d-e080-420b-b95b-1ac3fcd02075': ['healing', 'faith', 'testimony'],                         // Miracle Worker
  '8237fc71-9c8a-4268-8af4-3dd6a1b98889': ['faith', 'victory', 'trust'],                             // More Than Able
  '18154061-472c-4bc4-9033-6849b77b36b3': ['gratitude', 'faithfulness'],                             // More Than Enough

  // N
  '11c97633-d358-482d-a975-d483f264cf43': ['praise', 'worship'],                                     // Name Above All Names
  '58da3f8b-1696-46a3-be9e-509f1207237c': ['love', 'faithfulness', 'trust'],                         // Never Let You Go
  '873b2144-aefa-4137-a1f3-9da2bc15cce4': ['hope', 'renewal', 'faith'],                              // New Thing Coming
  '1728be00-e5ce-4d2b-9ba9-fc1bd7dd8d25': ['freedom', 'love', 'identity'],                           // No Longer Slaves
  'fe9792b4-494a-4bdc-bdff-87cdbfa40e65': ['freedom', 'healing', 'salvation'],                       // No Longer Bound
  '616139d1-bb94-4080-a8d7-b9bf74d595d4': ['worship', 'praise', 'glory'],                            // No One
  '2d4f976d-c385-4120-b276-e9c03a47f209': ['worship', 'praise', 'glory'],                            // No One Like The Lord (Live)
  'c33ccab2-1770-4172-bc12-9215a025675f': ['salvation', 'cross', 'redemption'],                      // Nothing but the Blood
  '07404739-7ce1-4b41-ae39-033467ddae10': ['surrender', 'devotion', 'worship'],                      // Nothing Else

  // O
  '2a80750e-44ec-4eed-ad77-c9c1720d8a9d': ['resurrection', 'praise', 'glory'],                       // O Praise The Name
  'a0969757-9df0-4238-aa75-bdc7d87acd5c': ['victory', 'glory', 'worship'],                           // Our God Reigns
  '1accda4a-5b38-450a-8fdc-0c03a84bd893': ['praise', 'gratitude'],                                   // Owe You Praise

  // P
  '0e4207f2-49db-4e5c-946a-4b8916e60ef6': ['praise', 'joy', 'celebration'],                          // Phenomena (DA DA)
  'f78618b3-fd56-4d19-862c-22747cb67d49': ['praise', 'worship'],                                     // Praise
  'd6f87da4-d1da-4418-8076-d0176e3dafcb': ['praise', 'joy', 'worship'],                              // Praise God
  '35e80a07-9572-4bec-82ad-374c29587f71': ['grace', 'love', 'salvation'],                            // Prodigal Praise

  // R
  '41f8e529-6199-4487-8e6a-6f8708ecb800': ['love', 'grace', 'salvation'],                            // Reckless Love
  '9d3a7a90-3855-44d1-9216-b9dced33fcec': ['redemption', 'salvation'],                               // Redeemer
  'cbb2be3e-4dca-4538-888b-19aae6af0a79': ['holy spirit', 'presence', 'peace'],                      // Rest On Us
  '17bc863b-2b1d-45b3-84fe-4f96a1345682': ['salvation', 'love', 'grace'],                            // Rescue
  '83061c81-92a8-443f-ab04-50a8d7423290': ['resurrection', 'victory', 'salvation'],                  // Resurrecting
  '2e553a61-83ac-475b-a6f4-c05d28313847': ['worship', 'praise', 'presence'],                         // Right Now

  // S
  '67acfcc4-4d4e-4681-a98a-a2aecb252d74': ['grace', 'love', 'cross', 'salvation'],                   // Scandal Of Grace
  '9659d8e8-67d0-4996-b0b4-c6bb08f65882': ['holy spirit', 'revival', 'presence'],                    // Set A Fire
  '2f1ac6a5-c97f-44ce-8174-7c821413a31f': ['praise', 'worship'],                                     // Sing The Name
  '6d5fec51-dfe0-4626-9f1e-44a1b1fe687c': ['worship', 'surrender'],                                  // So Be It
  '99734a02-6d28-4ff7-b5e1-4f63d83431c9': ['surrender', 'grace'],                                    // So Much Better (I Yield)
  'e4a0af46-6557-4de2-961c-17af05ac9467': ['holy spirit', 'revival', 'presence'],                    // Spirit Break Out
  '3f2baf7c-fbaa-4e4d-ac27-cb2104717d69': ['faith', 'trust', 'peace'],                               // State Of Mind
  '07ae60b8-a0f6-4c05-86a9-c566194e5509': ['faith', 'hope', 'trust'],                                // Surely (Live)

  // T
  '09db7f03-70c2-4f9e-99b1-392d489e8eb2': ['freedom', 'salvation', 'gratitude'],                     // Thank God I'm Free
  '57da5918-f8ca-4b43-bae3-6ed36bac848a': ['salvation', 'cross', 'redemption', 'gratitude'],         // Thank You Jesus For The Blood
  'aecd1ce4-4500-404c-9f41-8a3f67a4701d': ['praise', 'worship'],                                     // The Anthem
  '1355766a-57b6-48a1-b524-bac750544926': ['blessing', 'love', 'faithfulness'],                      // The Blessing
  'f8912afa-e831-4f0d-8688-7ef72c0f1865': ['salvation', 'cross', 'redemption'],                      // The Blood
  '14b27a23-1ef9-4834-bb18-5fe18a11abb3': ['worship', 'devotion', 'surrender'],                      // The Heart Of Worship
  '93e54c80-b1db-4673-a045-f719c179830b': ['joy', 'praise'],                                         // The Joy
  'd23013e9-e6a5-4ad0-9fec-33ab5917d234': ['worship', 'glory', 'cross'],                             // The Lamb (Alleluia)
  '94cd2c8d-d21d-4a8c-b7f3-4dd837638a4a': ['praise'],                                                // The Name Above (Live in Manila)
  '8c5e51e0-9cec-427f-a80b-696d7915e967': ['salvation', 'cross', 'redemption'],                      // The Wonderful Blood + Nothing But The Blood
  'dd02bf0d-3e9d-40cb-9ba3-51202fcdf1a7': ['worship', 'love'],                                       // This Is Forever
  '1e8aa7c0-5baa-499d-8b2f-223bd0b0d381': ['joy', 'celebration', 'praise'],                          // This Is How We Party
  'e8e25f9d-5d56-42ab-990a-9856f4a8a3a5': ['worship', 'presence', 'glory'],                          // Throne Room Song
  '1eb4a62a-e782-409b-ad3d-5ef92a6cca0c': ['faith', 'hope'],                                         // Till the Walls Come Down
  '28a9b3c7-2d2d-49ab-8a78-b142b21ae215': ['faith', 'trust', 'peace'],                               // Trust In God

  // V
  '505793a5-8c2d-4f67-a616-39af0725131b': ['praise', 'joy', 'celebration'],                          // Vámonos (Live)

  // W
  'a9169445-bf58-43be-bfe2-f558caf989ba': ['salvation', 'redemption', 'grace'],                      // Washed
  'df568947-6267-4c60-b008-c426021931ae': ['faith', 'hope', 'healing'],                              // Way Maker
  '9f487c90-0520-4540-9ebb-e34501b2855d': ['worship', 'glory', 'love'],                              // What A Beautiful Name
  '6f7fafd5-6831-4fe3-bd35-6a99667b9237': ['faith', 'testimony', 'healing'],                         // What A Miracle
  '32461e0a-e3dd-4528-ace0-d7a51afd41c3': ['worship', 'praise', 'glory'],                            // What a God
  'daff8ae6-14fb-40c1-bbbd-9c6c710d5291': ['worship', 'praise', 'glory'],                            // What An Awesome God (Phil Wickham)
  'c3cf6470-f594-4adc-9ada-a6335b79e898': ['worship', 'praise', 'glory'],                            // What An Awesome God (Dän Zeltner)
  'cfb01642-6a9f-46a4-8e82-21757e5f9962': ['holy spirit', 'revival', 'presence'],                    // When Wind Meets Fire
  'd10779b6-98ef-4cf4-8bc8-33d426a02157': ['worship', 'praise', 'glory'],                            // Who Else
  'a55f2488-47f7-4464-9750-ddec55963219': ['worship', 'praise', 'glory'],                            // Worthy
  'd5e8bc4b-1d97-4d2f-8ba2-9d720634cfaa': ['worship', 'surrender', 'praise'],                        // Worthy Of It All

  // Y
  '3bc9d7f2-413b-4f41-a563-804fc4b215da': ['love', 'worship', 'praise'],                             // Yahweh We Love You
  'e65183a0-d6f3-4f1e-90b8-e89b16e9d7c2': ['gratitude', 'worship', 'praise'],                        // You Are Good
  '2a2ac48c-14ce-4820-a065-6d1beeaf842c': ['worship', 'praise', 'devotion'],                         // You're Worthy Of My Praise
};

async function run() {
  const supabase = getSupabase();
  const entries = Object.entries(THEME_MAP);
  console.log(`\nApplying themes to ${entries.length} songs...\n`);

  // 1. Seed new themes into app_settings
  const { data: settingsRow } = await supabase
    .from('app_settings')
    .select('values')
    .eq('key', 'custom_themes')
    .single();

  const existing: string[] = settingsRow?.values ?? [];
  const toAdd = NEW_THEMES.filter(t => !existing.includes(t));
  if (toAdd.length) {
    const merged = [...existing, ...toAdd].sort();
    await supabase.from('app_settings').update({ values: merged }).eq('key', 'custom_themes');
    console.log(`✓ Added ${toAdd.length} new themes to settings: ${toAdd.join(', ')}\n`);
  } else {
    console.log(`⊘ All new themes already exist in settings\n`);
  }

  // 2. Apply themes to each song's song_metadata
  let updated = 0;
  let failed = 0;

  for (const [songId, themes] of entries) {
    const { error } = await supabase
      .from('song_metadata')
      .update({ themes })
      .eq('song_id', songId);

    if (error) {
      console.log(`✗ Failed [${songId}]: ${error.message}`);
      failed++;
    } else {
      updated++;
    }
  }

  console.log(`\n─────────────────────────────`);
  console.log(`✓ Updated: ${updated}`);
  console.log(`✗ Failed:  ${failed}`);
  console.log(`─────────────────────────────\n`);
}

run().catch(console.error);
