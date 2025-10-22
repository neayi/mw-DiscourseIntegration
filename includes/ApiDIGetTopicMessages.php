<?php
/*
 * Copyright (c) 2017 The MITRE Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

namespace MediaWiki\Extension\DiscourseIntegration;

class ApiDIGetTopicMessages extends ApiDIBase {

	/**
	 * @param ApiMain $main main module
	 * @param string $action name of this module
	 */
	public function __construct( $main, $action ) {
		parent::__construct( $main, $action, false );
	}

	/**
	 * the real body of the execute function
	 *
	 * @return result of API request
	 */
	protected function executeBody() {
		$wikiTitle = $this->currentPage->getTitle();
		$external_id = $wikiTitle->getArticleID();

		$api = $this->getDiscourseAPI();
		$apiResult = $this->getResult();
		$r = [];
		
		try {
			$res = $api->getTopicByExternalID($external_id);
			
			
			// Check if we got a valid response
			if (!empty($res->apiresult) && !isset($res->apiresult->errors)) {
				$r['topic'] = $res->apiresult;
			} else {
				// Topic doesn't exist or there was an error - return empty topic
				// Log the response for debugging if it's not a simple 404
				if (!empty($res->http_code) && $res->http_code !== 404) {
					wfDebugLog('DiscourseIntegration', 
						'Unexpected HTTP response in digettopicmessages: ' . $res->http_code . 
						', external_id: ' . $external_id .
						', response: ' . print_r($res, true)
					);
				}
				$r['topic'] = [];
			}
			
		} catch (\Exception $e) {
			// Log the error for debugging in production
			wfDebugLog('DiscourseIntegration', 
				'Exception in digettopicmessages: ' . $e->getMessage() . 
				', external_id: ' . $external_id .
				', trace: ' . $e->getTraceAsString()
			);
			
			// Return empty topic instead of throwing exception
			$r['topic'] = [];
		}
		
		$apiResult->addValue( null, $this->getModuleName(), $r );
	}


	/**
	 * @return array examples of the use of this API module
	 */
	public function getExamplesMessages() {
		return [
			'action=' . $this->getModuleName() . '&pageid=3' =>
			'apihelp-' . $this->getModuleName() . '-pageid-example'
		];
	}

	/**
	 * @return string indicates that this API module does not require a CSRF toekn
	 */
	public function needsToken() {
		return false;
	}
}
