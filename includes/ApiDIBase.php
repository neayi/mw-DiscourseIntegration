<?php
/*
 * Copyright (c) 2016 The MITRE Corporation
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

use ApiBase;
use ApiMessage;
use ApiMain;
use Wikimedia\ParamValidator\ParamValidator;

abstract class ApiDIBase extends ApiBase {

	private $edit;
	protected $currentPage;

	/**
	 * @param ApiMain $main main module
	 * @param string $action name of this module
	 * @param bool $edit whether this API module will be editing the database
	 */
	public function __construct( $main, $action, $edit = false ) {
		parent::__construct( $main, $action );
		$this->edit = $edit;
	}

	/**
	 * execute the API request
	 */
	public function execute() {
		$params = $this->extractRequestParams();
		$this->currentPage = $this->getTitleOrPageId( $params );

		$result = $this->executeBody();
		if ( $result !== null ) {
			$this->getResult()->addValue( null, $this->getModuleName(), $result );
		}
	}

	/**
	 * the real body of the execute function
	 */
	abstract protected function executeBody();

	/**
	 * @return array allowed parameters
	 */
	public function getAllowedParams() {
		return [
			'pageid' => [
				ParamValidator::PARAM_TYPE => 'integer',
				ParamValidator::PARAM_REQUIRED => false
			],
			'title' => [
				ParamValidator::PARAM_TYPE => 'string',
				ParamValidator::PARAM_REQUIRED => false
			]
		];
	}

	/**
	 * @return array examples of the use of this API module
	 */
	public function getExamplesMessages() {
		return [
			'action=' . $this->getModuleName() . '&pageid=3' =>
			'apihelp-' . $this->getModuleName() . '-pageid-example',
			'action=' . $this->getModuleName() . '&title=DiscourseIntegration:3' =>
			'apihelp-' . $this->getModuleName() . '-title-example'
		];
	}

	/**
	 * @return string indicates that this API module requires a CSRF token
	 */
	public function needsToken() {
		if ( $this->edit ) {
			return 'csrf';
		} else {
			return false;
		}
	}

	protected function getTopicIdForPageId()
	{
		$wikiTitle = $this->currentPage->getTitle();

		$pageURL = $wikiTitle->getFullURL('', false, 'https://');

		$api = $this->getDiscourseAPI();

		$r = $api->getPostsByEmbeddedURL($pageURL);

		if (isset($r->apiresult->topic_id))
			return $r->apiresult->topic_id;

		return false;
	}

	/**
	 * Find the Discourse username for the currently logged in user on the wiki.
	 * If the user does not exists, create it
	 */
	protected function getCurrentlyLoggedInDiscourseUserName()
	{
		$user = $this->getUser();

		if ( $user->isAnon() ) {
			$this->dieCustomUsageMessage(
				'discourseintegration-api-error-watch-notloggedin' );
		}

		// Find the email of the logged in user
		if ( $user->isAnon() ) {
			// Should not be possible, this is a special
		}

		$userEmail = $user->getEmail();
		$userEmail = str_replace('tripleperformance.fr', 'neayi.com', $userEmail);

		// Find the user on discourse
		$api = $this->getDiscourseAPI();
        $username = $api->getUsernameByEmail($userEmail);
        if (!empty($username))
	        return $username;

		// Not found ? Create it now (it will be synched properly by insights later)
		try {
			return $api->createDiscourseUser($user);
		} catch (\Throwable $th) {
			if (!empty($username))
			{
				$this->dieCustomUsageMessage(
					'discourseintegration-api-error-watch-no-discourse-user' );
			}
		}
	}

	/**
	 * die with a custom usage message
	 * @param string $message_name the name of the custom message
	 */
	protected function dieCustomUsageMessage( $message_name ) {
		$error_message = wfMessage( $message_name );
		$this->dieWithError($error_message);
	}

	protected function getDiscourseAPI()
	{
		if ( empty($GLOBALS['wgDiscourseAPIKey']) || empty($GLOBALS['wgDiscourseHost']) )
			throw new \MWException("\nPlease define \$wgDiscourseAPIKey and \$wgDiscourseHost\n", 1);

		if ($GLOBALS['env'] == 'dev')
		{
			return new \DiscourseAPI($GLOBALS['wgDiscourseHost'], $GLOBALS['wgDiscourseAPIKey'],
									'http', '', '', true);
		}
		else
		{
			return new \DiscourseAPI($GLOBALS['wgDiscourseHost'], $GLOBALS['wgDiscourseAPIKey'],
									'https', '', '', false);
		}
	}
}
