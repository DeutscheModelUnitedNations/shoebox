import './user';
import './processingJob';
import './upload';
import './manage';
import './admin';
import { building, dev } from '$app/environment';
import { clientCreator } from '$api/rumble';

if (dev || building) {
	await clientCreator({
		outputPath: 'src/lib/api/rumbleClient',
		apiUrl: '/api/graphql',
		useExternalUrqlClient: '../client',
		removeExisting: false,
		autoIncludeIdField: false
	});
}
